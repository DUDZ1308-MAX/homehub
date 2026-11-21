import type { EventItem, Prefs } from '../types';

export const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
};

export const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayKey = () => localDateKey(new Date());

export const splitLocalDateTime = (value: string) => {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return {
    date: localDateKey(date),
    time: `${hours}:${minutes}`,
  };
};

export const eventTimeLabel = (
  value: string,
  clock24: boolean,
  allDay?: boolean
) => {
  if (allDay) return 'All day';
  return new Date(value).toLocaleTimeString([], {
    hour: clock24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !clock24,
  });
};

export const dayLabel = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString([], { weekday: 'short' });

export const hourLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric' });

export const longDateLabel = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export const shortDateLabel = (value: string) =>
  new Date(value + 'T12:00:00').toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

export const weatherLabel = (code: number) => {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Mostly sunny';
  if (code === 3) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Conditions';
};

export const weatherMood = (code: number) => {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3, 45, 48].includes(code)) return 'cloudy';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
};

export const temperature = (celsius: number, unit: Prefs['tempUnit']) =>
  Math.round(unit === 'f' ? (celsius * 9) / 5 + 32 : celsius);

export const temperatureUnit = (unit: Prefs['tempUnit']) =>
  unit === 'f' ? 'F' : 'C';

export const wind = (kilometresPerHour: number, unit: Prefs['windUnit']) =>
  Math.round(unit === 'mph' ? kilometresPerHour * 0.621371 : kilometresPerHour);

export const windUnit = (unit: Prefs['windUnit']) =>
  unit === 'mph' ? 'mph' : 'km/h';

export const uvLabel = (value: number) => {
  if (value < 3) return 'Low';
  if (value < 6) return 'Moderate';
  if (value < 8) return 'High';
  return 'Very high';
};

export const eventStartDate = (event: EventItem) => new Date(event.start);

export const eventEndDate = (event: EventItem) => {
  if (event.end) return new Date(event.end);
  const start = new Date(event.start);
  if (event.allDay) return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return new Date(start.getTime() + 60 * 60 * 1000);
};

export const sortEvents = (events: EventItem[]) =>
  [...events].sort(
    (a, b) => eventStartDate(a).getTime() - eventStartDate(b).getTime()
  );

export const eventsForDate = (events: EventItem[], dateKey: string) =>
  sortEvents(events.filter(event => localDateKey(eventStartDate(event)) === dateKey));

export const countdownLabel = (milliseconds: number) => {
  if (milliseconds <= 0) return 'now';
  const minutes = Math.round(milliseconds / 60000);
  if (minutes < 1) return 'in <1 min';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `in ${hours}h ${rest}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
};

export const nextEventInfo = (events: EventItem[], now: Date) => {
  const nowMs = now.getTime();
  const next = sortEvents(events).find(
    event => eventEndDate(event).getTime() > nowMs
  );
  if (!next) return null;
  const start = eventStartDate(next).getTime();
  const end = eventEndDate(next).getTime();
  return {
    event: next,
    inProgress: start <= nowMs && end > nowMs,
    millisecondsUntil: start - nowMs,
    countdown: countdownLabel(start - nowMs),
  };
};

export const relativeTime = (iso: string, now: Date) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'just now';
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

export const geocodePlace = async (query: string) => {
  const params = new URLSearchParams({
    name: query,
    count: '1',
    language: 'en',
    format: 'json',
  });
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`
  );
  if (!response.ok) throw new Error('Location search is temporarily unavailable.');
  const data = (await response.json()) as {
    results?: {
      name: string;
      latitude: number;
      longitude: number;
      admin1?: string;
      country?: string;
    }[];
  };
  const place = data.results?.[0];
  if (!place) throw new Error('No matching place found. Try a nearby city.');
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    label: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
  };
};

export const weatherCacheKey = (prefs: Prefs) =>
  prefs.useDeviceLocation
    ? 'device'
    : prefs.manualLocation
      ? `manual:${prefs.manualLocation.latitude},${prefs.manualLocation.longitude}`
      : 'none';
