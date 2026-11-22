import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Monitor,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { EventItem, EventSaveInput, Prefs, Task } from './types';
import { defaultPrefs } from './types';
import {
  eventEndDate,
  eventStartDate,
  eventTimeLabel,
  eventsForDate,
  localDateKey,
  nextEventInfo,
  sortEvents,
  todayKey,
  uid,
} from './lib/homehub';
import {
  DEFAULT_UCB_STATION_ID,
  UCB_STATION_GROUPS,
  findUcbStation,
  type UcbStation,
} from './lib/ucbStations';
import {
  SOUNDWAVE_CURVES,
  SOUNDWAVE_CURVE_COUNT,
  SOUNDWAVE_GRADIENTS,
  SOUNDWAVE_HEIGHT,
  SOUNDWAVE_WIDTH,
  SOUNDWAVE_CENTER,
  type SoundwaveFormat,
  SOUNDWAVE_FORMATS,
} from './lib/soundwave';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { useNow } from './hooks/useNow';
import { useWeather } from './hooks/useWeather';
import { useWakeLock } from './hooks/useWakeLock';
import { LiveClock } from './components/LiveClock';
import { WeatherPanel } from './components/WeatherPanel';
import { CalendarPanel } from './components/CalendarPanel';
import { TasksPanel } from './components/TasksPanel';
import { NotesPanel } from './components/NotesPanel';
import { EventModal } from './components/EventModal';
import { SettingsModal } from './components/SettingsModal';

type GoogleSession = {
  token: string;
  expiresAt: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (result: {
              access_token?: string;
              error?: string;
              expires_in?: number;
            }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GOOGLE_SESSION_KEY = 'homehub-google-session';

type RadioPhase = 'idle' | 'connecting' | 'buffering' | 'playing' | 'paused' | 'error';


const readGoogleSession = (): GoogleSession | null => {
  try {
    const raw = sessionStorage.getItem(GOOGLE_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as GoogleSession;
    if (session.expiresAt > Date.now() + 30_000) return session;
    sessionStorage.removeItem(GOOGLE_SESSION_KEY);
  } catch {
    // A malformed session is treated as signed out.
  }
  return null;
};

const saveGoogleSession = (token: string, expiresIn?: number) => {
  const session: GoogleSession = {
    token,
    expiresAt: Date.now() + Math.max(60, expiresIn ?? 3600) * 1000,
  };
  try {
    sessionStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // The session still works in memory when storage is unavailable.
  }
  return session;
};

const loadGoogleIdentity = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Google sign-in could not load')),
        { once: true }
      );
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in could not load'));
    document.head.appendChild(script);
  });

function App() {
  const now = useNow(30_000);
  const [prefs, setPrefs] = useLocalStorageState<Prefs>(
    'homehub-prefs',
    defaultPrefs
  );
  const [events, setEvents] = useLocalStorageState<EventItem[]>(
    'homehub-events',
    []
  );
  const [tasks, setTasks] = useLocalStorageState<Task[]>('homehub-tasks', []);
  const [notes, setNotes] = useLocalStorageState<string>('homehub-notes', '');
  const [clientId, setClientId] = useLocalStorageState<string>(
    'homehub-google-client',
    ''
  );
  const weather = useWeather(prefs);
  const wakeLock = useWakeLock(prefs.keepAwake);

  const [googleSession, setGoogleSession] = useState<GoogleSession | null>(() =>
    readGoogleSession()
  );
  const [googleStatus, setGoogleStatus] = useState(() =>
    readGoogleSession() ? 'Connected · session restored' : 'Not connected'
  );
  const [googleLastSync, setGoogleLastSync] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [eventModal, setEventModal] = useState<{
    event: EventItem | null;
    date: string;
  } | null>(null);
  const [weatherMotionPaused, setWeatherMotionPaused] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const radioAudioRef = useRef<HTMLAudioElement>(null);
  const radioAnalyserRef = useRef<AnalyserNode | null>(null);
  const radioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const radioRequestRef = useRef(0);
  const soundwaveCurvesRef = useRef<(SVGElement | null)[]>([]);
  const soundwaveGlowRefs = useRef<(SVGRectElement | null)[]>([]);
  const soundwaveZonesRef = useRef<(SVGRectElement | null)[]>([]);
  const soundwaveFrameRef = useRef<number | null>(null);
  const soundwaveLevelsRef = useRef<number[]>([]);
  const soundwavePathRef = useRef<SVGPathElement | null>(null);
  const visualizerFormatRef = useRef<SoundwaveFormat>('bars');
  const visualizerRotationRef = useRef(0);
  const [selectedStationId, setSelectedStationId] = useLocalStorageState<string>(
    'homehub-ucb-station',
    DEFAULT_UCB_STATION_ID
  );
  const selectedStation =
    findUcbStation(selectedStationId) ??
    findUcbStation(DEFAULT_UCB_STATION_ID)!;
  const [radioPhase, setRadioPhase] = useState<RadioPhase>('idle');
  const [analyserReady, setAnalyserReady] = useState(false);
  const [focusedBar, setFocusedBar] = useState(0);
  const [waveform, setWaveform] = useState<OscillatorType>('triangle');
  const [synthVolume, setSynthVolume] = useState(0.22);
  const [visualizerFormat, setVisualizerFormat] = useState<SoundwaveFormat>('bars');
  visualizerFormatRef.current = visualizerFormat;

  const radioPlaying =
    radioPhase === 'connecting' ||
    radioPhase === 'buffering' ||
    radioPhase === 'playing';
  const radioStatus =
    radioPhase === 'playing'
      ? `Live · ${selectedStation.name}`
      : radioPhase === 'buffering'
        ? `Buffering · ${selectedStation.name}`
        : radioPhase === 'connecting'
          ? `Connecting · ${selectedStation.name}`
          : radioPhase === 'error'
            ? 'Stream unavailable. Check your connection and press Play to retry.'
            : radioPhase === 'paused'
              ? `Paused · ${selectedStation.name}`
              : `Ready · ${selectedStation.name}`;

  useEffect(() => {
    if (!findUcbStation(selectedStationId)) {
      setSelectedStationId(DEFAULT_UCB_STATION_ID);
    }
  }, [selectedStationId, setSelectedStationId]);

  const stopSoundwave = () => {
    if (soundwaveFrameRef.current !== null) {
      cancelAnimationFrame(soundwaveFrameRef.current);
      soundwaveFrameRef.current = null;
    }
    const levels = soundwaveLevelsRef.current;
    for (let index = 0; index < SOUNDWAVE_CURVE_COUNT; index += 1) {
      levels[index] = 0.05;
    }
    renderVisualizer();
  };

  const renderVisualizer = () => {
    const levels = soundwaveLevelsRef.current;
    const cx = SOUNDWAVE_WIDTH / 2;
    const cy = SOUNDWAVE_HEIGHT / 2;

    if (visualizerFormatRef.current === 'bars') {
      const bars = soundwaveCurvesRef.current;
      const glows = soundwaveGlowRefs.current;
      for (let index = 0; index < bars.length; index += 1) {
        const bar = bars[index];
        if (!bar) continue;
        const height = Math.max(0, levels[index] * SOUNDWAVE_HEIGHT);
        bar.setAttribute('height', height.toFixed(1));
        bar.setAttribute('y', (SOUNDWAVE_HEIGHT - height).toFixed(1));
        const glow = glows[index];
        if (glow) {
          glow.setAttribute('height', height.toFixed(1));
          glow.setAttribute('y', (SOUNDWAVE_HEIGHT - height).toFixed(1));
        }
      }
    } else if (visualizerFormatRef.current === 'circle') {
      const elements = soundwaveCurvesRef.current;
      const radius = 72;
      const thickness = 4;
      const maxLength = 40;
      const spin = (visualizerRotationRef.current * 180) / Math.PI;
      for (let index = 0; index < elements.length; index += 1) {
        const el = elements[index];
        if (!el) continue;
        const angle = (index / elements.length) * Math.PI * 2;
        const beatPulse = 1 + Math.sin(visualizerRotationRef.current * 3) * 0.15;
        const length =
          thickness +
          levels[index] * maxLength * beatPulse;
        const centerX = cx + radius * Math.cos(angle);
        const centerY = cy + radius * Math.sin(angle);
        el.setAttribute('x', (centerX - length / 2).toFixed(1));
        el.setAttribute('y', (centerY - thickness / 2).toFixed(1));
        el.setAttribute('width', length.toFixed(1));
        el.setAttribute('height', thickness.toFixed(1));
        el.setAttribute(
          'transform',
          `rotate(${spin + (angle * 180) / Math.PI},${centerX.toFixed(2)},${centerY.toFixed(2)})`
        );
        el.setAttribute('opacity', (0.4 + levels[index] * 0.6).toFixed(2));
      }
    } else if (visualizerFormatRef.current === 'wave') {
      const path = soundwavePathRef.current;
      if (!path) return;
      const amplitude = 36;
      const points: [number, number][] = [];
      for (let index = 0; index < SOUNDWAVE_CURVE_COUNT; index += 1) {
        const x = (index / (SOUNDWAVE_CURVE_COUNT - 1)) * SOUNDWAVE_WIDTH;
        const y = cy + (levels[index] - 0.5) * amplitude * 2;
        points.push([x, y]);
      }
      let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
      for (let i = 1; i < points.length; i += 1) {
        d += ` L${points[i][0].toFixed(1)},${points[i][1].toFixed(1)}`;
      }
      path.setAttribute('d', d);
    } else if (visualizerFormatRef.current === 'radial') {
      const elements = soundwaveCurvesRef.current;
      const maxRadius = 96;
      const thickness = 3;
      const spin = (visualizerRotationRef.current * 180) / Math.PI;
      for (let index = 0; index < elements.length; index += 1) {
        const el = elements[index];
        if (!el) continue;
        const angle = (index / elements.length) * Math.PI * 2;
        const beatPulse = 1 + Math.cos(visualizerRotationRef.current * 2) * 0.1;
        const length = Math.max(1, levels[index] * maxRadius * beatPulse);
        el.setAttribute('x', (cx - thickness / 2).toFixed(1));
        el.setAttribute('y', cy.toFixed(1));
        el.setAttribute('width', thickness.toFixed(1));
        el.setAttribute('height', length.toFixed(1));
        el.setAttribute(
          'transform',
          `rotate(${spin + (angle * 180) / Math.PI},${cx.toFixed(2)},${cy.toFixed(2)})`
        );
        el.setAttribute('opacity', (0.2 + levels[index] * 0.8).toFixed(2));
      }
    } else if (visualizerFormatRef.current === 'dots') {
      const elements = soundwaveCurvesRef.current;
      const baseRadius = 2;
      const maxRadius = 9;
      for (let index = 0; index < elements.length; index += 1) {
        const el = elements[index];
        if (!el) continue;
        const x = (index / (elements.length - 1)) * SOUNDWAVE_WIDTH;
        const radius = baseRadius + levels[index] * maxRadius;
        el.setAttribute('cx', x.toFixed(1));
        el.setAttribute('cy', cy.toFixed(1));
        el.setAttribute('r', radius.toFixed(1));
        el.setAttribute('opacity', (0.3 + levels[index] * 0.7).toFixed(2));
      }
    }
  };

  const startSoundwave = () => {
    const analyser = radioAnalyserRef.current;
    if (!analyser) return;
    if (soundwaveFrameRef.current !== null) return;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const levels = soundwaveLevelsRef.current;
    for (let index = 0; index < SOUNDWAVE_CURVE_COUNT; index += 1) {
      levels[index] = 0.05;
    }
    const animate = () => {
      analyser.getByteFrequencyData(frequencyData);
      let frameMax = 0;
      for (let index = 0; index < frequencyData.length; index += 1) {
        if (frequencyData[index] > frameMax) frameMax = frequencyData[index];
      }
      let highest = frequencyData.length - 1;
      while (highest > 8 && frequencyData[highest] < 12) highest -= 1;
      const gate = Math.max(40, frameMax * 0.32);
      const span = Math.max(1, frameMax - gate);
      const usableBins = Math.max(4, highest - 2);
      for (let index = 0; index < SOUNDWAVE_CURVE_COUNT; index += 1) {
        const position = index / Math.max(1, SOUNDWAVE_CURVE_COUNT - 1);
        const bin = Math.round(2 + Math.pow(position, 1.25) * usableBins);
        const level = Math.min(
          1,
          Math.max(0, (frequencyData[bin] - gate) / span)
        );
        const target = 0.15 + level * 0.8;
        const current = levels[index] ?? 0.05;
        const next = current + (target - current) * 0.18;
        levels[index] = next;
      }
      visualizerRotationRef.current += 0.025;
      renderVisualizer();
      soundwaveFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  const ensureRadioAnalyser = () => {
    if (radioAnalyserRef.current) return true;
    const audio = radioAudioRef.current;
    if (!audio) return false;
    try {
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(context.destination);
      radioSourceRef.current = source;
      radioAnalyserRef.current = analyser;
      setAnalyserReady(true);
      return true;
    } catch {
      setAnalyserReady(false);
      return false;
    }
  };

  const startStation = async (station: UcbStation) => {
    const audio = radioAudioRef.current;
    if (!audio) return;
    const request = radioRequestRef.current + 1;
    radioRequestRef.current = request;
    setRadioPhase('connecting');
    ensureRadioAnalyser();
    try {
      if (audio.src !== station.stream || audio.error) {
        audio.src = station.stream;
        audio.load();
      }
      const playback = audio.play();
      await audioContextRef.current?.resume();
      await playback;
    } catch {
      if (radioRequestRef.current !== request) return;
      setRadioPhase('error');
      stopSoundwave();
    }
  };

  const changeStation = (stationId: string) => {
    const nextStation = findUcbStation(stationId);
    if (!nextStation) return;
    setSelectedStationId(stationId);
    if (radioPlaying) {
      void startStation(nextStation);
    } else if (radioPhase === 'error') {
      setRadioPhase('idle');
    }
  };

  const toggleRadio = () => {
    const audio = radioAudioRef.current;
    if (!audio) return;
    if (radioPlaying) {
      radioRequestRef.current += 1;
      audio.pause();
      setRadioPhase('paused');
      stopSoundwave();
      return;
    }
    void startStation(selectedStation);
  };

  useEffect(() => {
    return () => {
      radioRequestRef.current += 1;
      if (soundwaveFrameRef.current !== null) {
        cancelAnimationFrame(soundwaveFrameRef.current);
        soundwaveFrameRef.current = null;
      }
      radioSourceRef.current?.disconnect();
      radioAnalyserRef.current?.disconnect();
      radioSourceRef.current = null;
      radioAnalyserRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const playSynthNote = (frequency: number) => {
    const audio = audioContextRef.current || new AudioContext();
    audioContextRef.current = audio;
    void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      synthVolume,
      audio.currentTime + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.62);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.65);
  };

  const syncCalendar = useCallback(
    async (token: string) => {
      setBusy(true);
      try {
        const params = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin: new Date().toISOString(),
          maxResults: '50',
        });
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.status === 401) {
          throw new Error('Google session expired. Choose Sync calendar to reconnect.');
        }
        if (!response.ok) {
          throw new Error(
            'Calendar access failed. Check your Google Calendar API and OAuth settings.'
          );
        }
        const data = (await response.json()) as {
          items?: {
            id?: string;
            summary?: string;
            description?: string;
            start?: { dateTime?: string; date?: string };
            end?: { dateTime?: string; date?: string };
            location?: string;
            htmlLink?: string;
          }[];
        };
        const imported: EventItem[] = (data.items || [])
          .filter(item => item.start?.dateTime || item.start?.date)
          .map(item => {
            const allDay = !item.start?.dateTime && Boolean(item.start?.date);
            const start = item.start?.dateTime
              ? item.start.dateTime
              : `${item.start?.date}T00:00:00`;
            const end = item.end?.dateTime
              ? item.end.dateTime
              : item.end?.date
                ? `${item.end.date}T00:00:00`
                : undefined;
            return {
              id: 'g-' + (item.id || uid()),
              title: item.summary || 'Untitled event',
              start,
              end,
              allDay,
              source: 'google' as const,
              location: item.location,
              notes: item.description?.slice(0, 500),
              htmlLink: item.htmlLink,
            };
          });
        setEvents(previous => [
          ...previous.filter(event => event.source !== 'google'),
          ...imported,
        ]);
        setGoogleLastSync(new Date().toISOString());
        setGoogleStatus(
          `Connected · ${imported.length} upcoming event${
            imported.length === 1 ? '' : 's'
          }`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not load calendar';
        setGoogleStatus(message);
        if (message.includes('expired')) {
          setGoogleSession(null);
          try {
            sessionStorage.removeItem(GOOGLE_SESSION_KEY);
          } catch {
            // Ignore storage cleanup failures.
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [setEvents]
  );

  const autoSyncRef = useRef(false);
  useEffect(() => {
    if (autoSyncRef.current) return;
    autoSyncRef.current = true;
    if (googleSession) void syncCalendar(googleSession.token);
    // Restore a saved Google session once at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogle = async () => {
    if (!clientId.trim()) {
      setShowSettings(true);
      setGoogleStatus('Add your Google OAuth Client ID in settings first');
      return;
    }
    setBusy(true);
    setGoogleStatus('Connecting…');
    try {
      await loadGoogleIdentity();
      if (!window.google) throw new Error('Google sign-in is unavailable');
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: result => {
          if (!result.access_token) {
            setGoogleStatus(
              result.error || 'Google authorization was not completed'
            );
            setBusy(false);
            return;
          }
          const session = saveGoogleSession(
            result.access_token,
            result.expires_in
          );
          setGoogleSession(session);
          void syncCalendar(result.access_token);
        },
      });
      tokenClient.requestAccessToken();
    } catch (error) {
      setGoogleStatus(
        error instanceof Error ? error.message : 'Connection failed'
      );
      setBusy(false);
    }
  };

  const disconnectGoogle = () => {
    setGoogleSession(null);
    setGoogleStatus('Not connected');
    setGoogleLastSync('');
    try {
      sessionStorage.removeItem(GOOGLE_SESSION_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    setEvents(previous => previous.filter(event => event.source !== 'google'));
  };

  const openNewEvent = (date = selectedDate) =>
    setEventModal({ event: null, date });

  const openEvent = (event: EventItem) =>
    setEventModal({
      event,
      date: localDateKey(eventStartDate(event)),
    });

  const saveEvent = (input: EventSaveInput) => {
    if (input.id) {
      setEvents(previous =>
        previous.map(event =>
          event.id === input.id && event.source === 'local'
            ? {
                ...event,
                title: input.title,
                start: input.start,
                end: input.end,
                location: input.location,
                notes: input.notes,
              }
            : event
        )
      );
    } else {
      setEvents(previous => [
        ...previous,
        {
          id: uid(),
          title: input.title,
          start: input.start,
          end: input.end,
          location: input.location,
          notes: input.notes,
          source: 'local',
        },
      ]);
    }
    const savedDate = localDateKey(new Date(input.start));
    setSelectedDate(savedDate);
    setMonth(
      new Date(
        new Date(input.start).getFullYear(),
        new Date(input.start).getMonth(),
        1
      )
    );
    setEventModal(null);
  };

  const deleteEvent = (id: string) => {
    setEvents(previous => previous.filter(event => event.id !== id));
    setEventModal(null);
  };

  const addTask = (title: string) => {
    setTasks(previous => [
      ...previous,
      {
        id: uid(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const toggleTask = (id: string) => {
    setTasks(previous =>
      previous.map(task =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks(previous => previous.filter(task => task.id !== id));
  };

  const clearCompletedTasks = () => {
    setTasks(previous => previous.filter(task => !task.done));
  };

  const saveSettings = (nextPrefs: Prefs, nextClientId: string) => {
    setPrefs(nextPrefs);
    setClientId(nextClientId);
    setShowSettings(false);
    if (nextPrefs.keepAwake) void wakeLock.request();
    else void wakeLock.release();
    if (nextClientId !== clientId) {
      setGoogleStatus('Client ID saved. Select Sync calendar to connect.');
    }
  };

  const toggleKeepAwake = () => {
    if (wakeLock.active) {
      setPrefs(previous => ({ ...previous, keepAwake: false }));
      void wakeLock.release();
      return;
    }
    setPrefs(previous => ({ ...previous, keepAwake: true }));
    void wakeLock.request();
  };

  const exportData = () => {
    const payload = {
      app: 'HomeHub',
      version: 2,
      exportedAt: new Date().toISOString(),
      events,
      tasks,
      notes,
      prefs,
      googleClientId: clientId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `homehub-backup-${todayKey()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resetData = () => {
    [
      'homehub-events',
      'homehub-tasks',
      'homehub-notes',
      'homehub-prefs',
      'homehub-google-client',
      'homehub-weather-cache',
      'homehub-ucb-station',
    ].forEach(key => localStorage.removeItem(key));
    try {
      sessionStorage.removeItem(GOOGLE_SESSION_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    window.location.reload();
  };

  const todayEvents = useMemo(
    () => eventsForDate(events, todayKey()),
    [events]
  );
  const upcomingEvents = useMemo(
    () =>
      sortEvents(
        events.filter(event => eventEndDate(event).getTime() > now.getTime())
      ).slice(0, 5),
    [events, now]
  );
  const nextUp = useMemo(() => nextEventInfo(events, now), [events, now]);
  const dateText = now.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const greeting =
    now.getHours() < 12
      ? 'Good morning'
      : now.getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <strong>homehub</strong>
            <span>YOUR HOME, IN SYNC</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="location">
            <MapPin size={14} /> {weather.location}
          </div>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
          >
            <Settings size={19} />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">{dateText}</div>
          <h1>
            {greeting} <span>👋</span>
          </h1>
          <p>Here's what's happening around your home today.</p>
          {nextUp && (
            <div className="next-up-chip">
              <Clock3 size={14} />
              <span>{nextUp.inProgress ? 'Happening now' : 'Next up'}</span>
              <strong>{nextUp.event.title}</strong>
              <em>
                {nextUp.inProgress
                  ? nextUp.event.allDay
                    ? 'All day'
                    : 'In progress'
                  : nextUp.countdown}
              </em>
            </div>
          )}
        </div>
        <LiveClock clock24={prefs.clock24} />
      </section>

      <section className="overview-grid">
        <WeatherPanel
          now={now}
          weather={weather.weather}
          weatherError={weather.error}
          weatherLocation={weather.location}
          lastUpdated={weather.lastUpdated}
          loading={weather.loading}
          motionPaused={weatherMotionPaused}
          prefs={prefs}
          onToggleMotion={() => setWeatherMotionPaused(value => !value)}
          onRetry={() => void weather.refresh()}
        />

        <CalendarPanel
          month={month}
          events={events}
          selectedDate={selectedDate}
          clock24={prefs.clock24}
          weekStartsOn={prefs.weekStartsOn}
          onMonthChange={setMonth}
          onSelectDate={setSelectedDate}
          onAddEvent={openNewEvent}
          onOpenEvent={openEvent}
        />

        <div className="overview-side">
          <div className="agenda-stack">
            <article className="panel agenda-panel is-hidden" aria-hidden="true">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YOUR DAY AT A GLANCE</span>
                  <h2>Today's agenda</h2>
                </div>
                <button
                  className="text-action"
                  onClick={() => openNewEvent(todayKey())}
                >
                  <Plus size={15} /> Add event
                </button>
              </div>
              <div className="agenda-list">
                {todayEvents.length ? (
                  todayEvents.map(event => {
                    const isPast =
                      eventEndDate(event).getTime() < now.getTime();
                    return (
                      <div
                        className={`agenda-item ${isPast ? 'is-past' : ''}`}
                        key={event.id}
                      >
                        <div className="agenda-time">
                          {eventTimeLabel(
                            event.start,
                            prefs.clock24,
                            event.allDay
                          )}
                        </div>
                        <div className="agenda-line" />
                        <div className="agenda-details">
                          <strong>{event.title}</strong>
                          <span>
                            {event.source === 'google'
                              ? 'Google Calendar'
                              : 'Home event'}
                            {event.location ? ' · ' + event.location : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="agenda-edit"
                          onClick={() => openEvent(event)}
                          aria-label={`${
                            event.source === 'local' ? 'Edit' : 'View'
                          } ${event.title}`}
                        >
                          {event.source === 'local' ? (
                            <Pencil size={13} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <CalendarDays size={23} />
                    </div>
                    <strong>Your day is wide open</strong>
                    <span>No events scheduled for today.</span>
                    <button
                      className="subtle-button"
                      onClick={() => openNewEvent(todayKey())}
                    >
                      Add your first event
                    </button>
                  </div>
                )}
              </div>
              <div className="agenda-footer">
                <CalendarClock size={15} />
                <span>
                  {googleStatus}
                  {googleLastSync
                    ? ` · synced ${new Date(
                        googleLastSync
                      ).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : ''}
                </span>
                <button onClick={() => void connectGoogle()} disabled={busy}>
                  {busy ? 'Connecting…' : 'Sync calendar'}{' '}
                  <RefreshCw size={13} />
                </button>
              </div>
            </article>

            <article className="panel upcoming-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">COMING UP</span>
                  <h2>Next on the calendar</h2>
                </div>
                <CalendarDays size={19} className="muted-icon" />
              </div>
              {upcomingEvents.length ? (
                <div className="upcoming-list">
                  {upcomingEvents.map(event => (
                    <button
                      type="button"
                      className="upcoming-item"
                      key={event.id}
                      onClick={() => openEvent(event)}
                    >
                      <div className="upcoming-date">
                        <strong>{new Date(event.start).getDate()}</strong>
                        <span>
                          {new Date(event.start).toLocaleDateString([], {
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <div>
                        <strong>{event.title}</strong>
                        <span>
                          {new Date(event.start).toLocaleDateString([], {
                            weekday: 'long',
                          })}{' '}
                          ·{' '}
                          {eventTimeLabel(
                            event.start,
                            prefs.clock24,
                            event.allDay
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="upcoming-empty">
                  Your upcoming events will appear here.
                </div>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="lower-grid household-grid is-hidden" aria-hidden="true">
        <TasksPanel
          tasks={tasks}
          onAdd={addTask}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onClearCompleted={clearCompletedTasks}
        />
        <div className="is-hidden" aria-hidden="true">
          <NotesPanel value={notes} onChange={setNotes} />
        </div>
      </section>

      <section className="music-studio-grid">
        <article className="panel radio-panel music-control-panel">
          <div className="radio-title">
            <div className="radio-mark">
              <Radio size={20} />
            </div>
            <div>
              <span className="eyebrow">LIVE RADIO</span>
              <h2>UCB Radio</h2>
              <p>Be encouraged, inspired &amp; entertained</p>
            </div>
          </div>
          <div className="radio-station-card">
            <span className="radio-station-art">
              <Radio size={22} />
            </span>
            <div className="radio-station-info">
              <strong>{selectedStation.name}</strong>
              <span>
                {selectedStation.detail} · {selectedStation.province}
              </span>
            </div>
            <span className="radio-live-badge">LIVE</span>
          </div>
          <label className="radio-station-picker">
            <span>Station location</span>
            <select
              value={selectedStation.id}
              onChange={event => changeStation(event.target.value)}
            >
              {UCB_STATION_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.stations.map(station => (
                    <option key={station.id} value={station.id}>
                      {station.name} · {station.detail}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            className="music-main-toggle"
            type="button"
            onClick={toggleRadio}
          >
            {radioPlaying ? (
              <Pause size={21} fill="currentColor" />
            ) : (
              <Play size={21} fill="currentColor" />
            )}
            {radioPlaying ? 'Pause radio' : 'Play live radio'}
          </button>
          <div className="radio-meta-row">
            <span className="music-repeat-note">
              <span className={`status-dot ${radioPlaying ? 'is-live' : ''}`} />
              {radioPlaying ? 'Streaming live' : 'Live stream'}
            </span>
            <a
              href="https://www.ucbradio.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ucbradio.com
            </a>
          </div>
          <span
            className={`radio-status ${
              radioPhase === 'error'
                ? 'is-error'
                : radioPhase === 'playing'
                  ? 'is-live'
                  : ''
            }`}
            role="status"
            aria-live="polite"
          >
            {radioStatus}
          </span>
          <audio
            ref={radioAudioRef}
            className="radio-audio"
            crossOrigin="anonymous"
            preload="none"
            onPlaying={() => {
              setRadioPhase('playing');
              startSoundwave();
            }}
            onPause={() => {
              if (radioAudioRef.current?.error) return;
              setRadioPhase('paused');
              stopSoundwave();
            }}
            onWaiting={() => {
              if (!radioAudioRef.current?.paused) setRadioPhase('buffering');
            }}
            onError={() => {
              radioRequestRef.current += 1;
              setRadioPhase('error');
              stopSoundwave();
            }}
          />
        </article>

        <article className="panel synth-panel">
          <div className="synth-heading">
            <div className="radio-title">
              <div className="radio-mark synth-mark">
                <Music2 size={20} />
              </div>
              <div>
                <span className="eyebrow">PLAY SOMETHING</span>
                <h2>Color Soundwave</h2>
                <p>Tap the wave to play a tone</p>
              </div>
            </div>
            <label className="synth-wave-select">
              Sound
              <select
                value={waveform}
                onChange={event =>
                  setWaveform(event.target.value as OscillatorType)
                }
              >
                <option value="sine">Soft</option>
                <option value="triangle">Warm</option>
                <option value="square">Retro</option>
                <option value="sawtooth">Bright</option>
              </select>
            </label>
            <label className="synth-wave-select">
              Visualizer
              <select
                value={visualizerFormat}
                onChange={event =>
                  setVisualizerFormat(event.target.value as SoundwaveFormat)
                }
              >
                {SOUNDWAVE_FORMATS.map(format => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className={`synth-wave-visual ${
              radioPlaying
                ? analyserReady
                  ? 'is-reactive'
                  : 'is-playing'
                : 'is-paused'
            }`}
            role="group"
            aria-label={
              radioPlaying
                ? 'Soundwave synced to UCB Radio. Select a point along the wave to play a tone.'
                : 'Soundwave is idle. Select a point along the wave to play a tone.'
            }
          >
            <svg
              viewBox={`0 0 ${SOUNDWAVE_WIDTH} ${SOUNDWAVE_HEIGHT}`}
              preserveAspectRatio="none"
              className="soundwave-svg"
            >
              <defs>
                {SOUNDWAVE_GRADIENTS.map((colors, paletteIndex) => (
                  <linearGradient
                    key={paletteIndex}
                    id={`soundwave-gradient-${paletteIndex}`}
                    x1="0%"
                    y1="100%"
                    x2="0%"
                    y2="0%"
                  >
                    {colors.map((color, stopIndex) => (
                      <stop
                        key={color}
                        offset={`${
                          (stopIndex / (colors.length - 1)) * 100
                        }%`}
                        stopColor={color}
                      />
                    ))}
                  </linearGradient>
                ))}
              </defs>
              {visualizerFormatRef.current === 'bars' && (
                <>
                  <g aria-hidden="true" className="soundwave-glow">
                    {SOUNDWAVE_CURVES.map((_, index) => {
                      const gradientIndex = index % SOUNDWAVE_GRADIENTS.length;
                      return (
                        <rect
                          key={`glow-${index}`}
                          ref={element => {
                            soundwaveGlowRefs.current[index] = element;
                          }}
                          className="soundwave-glow-bar"
                          x={index * 15 + 2}
                          y={SOUNDWAVE_HEIGHT}
                          width="11"
                          height="0"
                          fill={`url(#soundwave-gradient-${gradientIndex})`}
                          rx="3"
                          opacity="0.5"
                        />
                      );
                    })}
                  </g>
                  <g aria-hidden="true" className="soundwave-bars">
                    {SOUNDWAVE_CURVES.map((_, index) => {
                      const gradientIndex = index % SOUNDWAVE_GRADIENTS.length;
                      return (
                        <rect
                          key={`bar-${index}`}
                          ref={element => {
                            soundwaveCurvesRef.current[index] = element;
                          }}
                          className="soundwave-bar"
                          x={index * 15 + 2}
                          y={SOUNDWAVE_HEIGHT}
                          width="11"
                          height="0"
                          fill={`url(#soundwave-gradient-${gradientIndex})`}
                          rx="2"
                          style={{ animationDelay: `${index * 18}ms` }}
                        />
                      );
                    })}
                  </g>
                </>
              )}
              {visualizerFormatRef.current === 'circle' && (
                <g aria-hidden="true" className="soundwave-circle">
                  {SOUNDWAVE_CURVES.map((_, index) => {
                    const gradientIndex = index % SOUNDWAVE_GRADIENTS.length;
                    return (
                      <rect
                        key={`circle-${index}`}
                        ref={element => {
                          soundwaveCurvesRef.current[index] = element;
                        }}
                        className="soundwave-circle-bar"
                        width="0"
                        height="4"
                        fill={`url(#soundwave-gradient-${gradientIndex})`}
                        rx="2"
                      />
                    );
                  })}
                </g>
              )}
              {visualizerFormatRef.current === 'wave' && (
                <path
                  ref={soundwavePathRef}
                  className="soundwave-wave-path"
                  fill="none"
                  stroke="url(#soundwave-gradient-0)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {visualizerFormatRef.current === 'radial' && (
                <g aria-hidden="true" className="soundwave-radial">
                  {SOUNDWAVE_CURVES.map((_, index) => {
                    const gradientIndex = index % SOUNDWAVE_GRADIENTS.length;
                    return (
                      <rect
                        key={`radial-${index}`}
                        ref={element => {
                          soundwaveCurvesRef.current[index] = element;
                        }}
                        className="soundwave-radial-bar"
                        x="0"
                        y="0"
                        width="3"
                        height="0"
                        fill={`url(#soundwave-gradient-${gradientIndex})`}
                        rx="1.5"
                      />
                    );
                  })}
                </g>
              )}
              {visualizerFormatRef.current === 'dots' && (
                <g aria-hidden="true" className="soundwave-dots">
                  {SOUNDWAVE_CURVES.map((_, index) => {
                    const gradientIndex = index % SOUNDWAVE_GRADIENTS.length;
                    return (
                      <circle
                        key={`dot-${index}`}
                        ref={element => {
                          soundwaveCurvesRef.current[index] = element;
                        }}
                        className="soundwave-dot"
                        cx="0"
                        cy={SOUNDWAVE_CENTER}
                        r="2"
                        fill={`url(#soundwave-gradient-${gradientIndex})`}
                      />
                    );
                  })}
                </g>
              )}
              {SOUNDWAVE_CURVES.map((_, index) => {
                const frequency =
                  220 *
                  Math.pow(2, (index / (SOUNDWAVE_CURVE_COUNT - 1)) * 2);
                return (
                  <rect
                    key={`zone-${index}`}
                    ref={element => {
                      soundwaveZonesRef.current[index] = element;
                    }}
                    className="soundwave-zone"
                    x={index * 15}
                    y="0"
                    width="15"
                    height={SOUNDWAVE_HEIGHT}
                    role="button"
                    tabIndex={index === focusedBar ? 0 : -1}
                    aria-label={`Play soundwave tone ${index + 1} of ${SOUNDWAVE_CURVE_COUNT}`}
                    onFocus={() => setFocusedBar(index)}
                    onClick={() => {
                      setFocusedBar(index);
                      playSynthNote(frequency);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        playSynthNote(frequency);
                        return;
                      }
                      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                        event.preventDefault();
                        const direction =
                          event.key === 'ArrowRight' ? 1 : -1;
                        const next =
                          (index +
                            direction +
                            SOUNDWAVE_CURVE_COUNT) %
                          SOUNDWAVE_CURVE_COUNT;
                        setFocusedBar(next);
                        soundwaveZonesRef.current[next]?.focus();
                      }
                      if (event.key === 'Home' || event.key === 'End') {
                        event.preventDefault();
                        const next =
                          event.key === 'Home' ? 0 : SOUNDWAVE_CURVE_COUNT - 1;
                        setFocusedBar(next);
                        soundwaveZonesRef.current[next]?.focus();
                      }
                    }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="synth-controls">
            <span>
              <Volume2 size={15} /> Volume
            </span>
            <input
              aria-label="Synthesizer volume"
              type="range"
              min="0.03"
              max="0.5"
              step="0.01"
              value={synthVolume}
              onChange={event => setSynthVolume(Number(event.target.value))}
            />
            <strong>{Math.round(synthVolume * 100)}%</strong>
          </div>
          <p className="synth-hint">
            The soundwave reacts to UCB Radio automatically while it plays. Tap
            any point along the wave to hear its own tone.
          </p>
        </article>
      </section>

      <footer className="footer">
        <span>
          <span className="status-dot" /> HOMEHUB IS READY
        </span>
        <div className="footer-actions">
          <button
            type="button"
            className={`footer-chip ${wakeLock.active ? 'is-active' : ''}`}
            onClick={toggleKeepAwake}
            disabled={!wakeLock.supported}
            aria-pressed={wakeLock.active}
            title={
              wakeLock.supported
                ? 'Keep this screen awake for a wall display'
                : 'Screen Wake Lock is not supported by this browser'
            }
          >
            <Monitor size={12} />
            {wakeLock.active ? 'Screen awake' : 'Keep screen on'}
          </button>
          <span>Made for the moments that make a home.</span>
        </div>
      </footer>

      {showSettings && (
        <SettingsModal
          prefs={prefs}
          clientId={clientId}
          googleConnected={Boolean(googleSession)}
          googleStatus={googleStatus}
          wakeLockSupported={wakeLock.supported}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onDisconnectGoogle={disconnectGoogle}
          onExport={exportData}
          onReset={resetData}
        />
      )}

      {eventModal && (
        <EventModal
          event={eventModal.event}
          initialDate={eventModal.date}
          clock24={prefs.clock24}
          onClose={() => setEventModal(null)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
    </main>
  );
}

export default App;
