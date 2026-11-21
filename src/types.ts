export type EventSource = 'google' | 'local';

export type EventItem = {
  id: string;
  title: string;
  start: string;
  end?: string;
  source: EventSource;
  location?: string;
  notes?: string;
  allDay?: boolean;
  htmlLink?: string;
};

export type Weather = {
  current: {
    temperature: number;
    apparent: number;
    code: number;
    humidity: number;
    wind: number;
    uv: number;
  };
  daily: {
    date: string;
    code: number;
    high: number;
    low: number;
    rain: number;
    sunrise: string;
    sunset: string;
    uvMax: number;
    windMax: number;
  }[];
};

export type WeatherCache = {
  key: string;
  weather: Weather;
  location: string;
  lastUpdated: string;
};

export type Prefs = {
  tempUnit: 'c' | 'f';
  windUnit: 'kmh' | 'mph';
  clock24: boolean;
  weekStartsOn: 0 | 1;
  useDeviceLocation: boolean;
  manualLocation: {
    latitude: number;
    longitude: number;
    label: string;
  } | null;
  keepAwake: boolean;
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export type EventSaveInput = {
  id?: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  notes?: string;
};

export const defaultPrefs: Prefs = {
  tempUnit: 'c',
  windUnit: 'kmh',
  clock24: false,
  weekStartsOn: 0,
  useDeviceLocation: true,
  manualLocation: null,
  keepAwake: false,
};
