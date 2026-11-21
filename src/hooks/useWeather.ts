import { useCallback, useEffect, useRef, useState } from 'react';
import type { Prefs, Weather, WeatherCache } from '../types';
import { readStorage, weatherCacheKey, writeStorage } from '../lib/homehub';

type WeatherState = {
  weather: Weather | null;
  location: string;
  lastUpdated: string | null;
  loading: boolean;
  error: string;
};

const readCache = (prefs: Prefs) => {
  const cache = readStorage<WeatherCache | null>('homehub-weather-cache', null);
  return cache && cache.key === weatherCacheKey(prefs) ? cache : null;
};

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 15 * 60 * 1000,
    });
  });

const locationErrorMessage = (error: unknown) => {
  const code = (error as GeolocationPositionError)?.code;
  if (code === 1) {
    return 'Allow location access in your browser, then try again to see weather for your area.';
  }
  if (code === 2 || code === 3) {
    return 'Could not determine your location. Check device location services and try again.';
  }
  return error instanceof Error
    ? error.message
    : 'Weather is temporarily unavailable. Please try again.';
};

export function useWeather(prefs: Prefs) {
  const [initialCache] = useState(() => readCache(prefs));
  const [state, setState] = useState<WeatherState>({
    weather: initialCache?.weather ?? null,
    location: initialCache?.location ?? 'Finding your location…',
    lastUpdated: initialCache?.lastUpdated ?? null,
    loading: !initialCache,
    error: '',
  });
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const cacheKey = weatherCacheKey(prefs);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(previous => ({ ...previous, loading: true, error: '' }));

    try {
      let latitude: number;
      let longitude: number;
      let manualLabel = '';

      if (prefs.useDeviceLocation) {
        const position = await getPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        setState(previous => ({ ...previous, location: 'Your current area' }));
      } else {
        if (!prefs.manualLocation) {
          throw new Error(
            'Choose a weather location in settings, or switch back to device location.'
          );
        }
        latitude = prefs.manualLocation.latitude;
        longitude = prefs.manualLocation.longitude;
        manualLabel = prefs.manualLocation.label;
      }

      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current:
          'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index',
        daily:
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max',
        timezone: 'auto',
        forecast_days: '7',
      });
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error('Weather provider unavailable');
      const data = (await response.json()) as {
        current: {
          temperature_2m: number;
          apparent_temperature: number;
          weather_code: number;
          relative_humidity_2m: number;
          wind_speed_10m: number;
          uv_index: number;
        };
        daily: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_probability_max: number[];
          sunrise: string[];
          sunset: string[];
          uv_index_max: number[];
          wind_speed_10m_max: number[];
        };
      };

      let locationLabel = manualLabel || 'Your current area';
      if (prefs.useDeviceLocation) {
        try {
          const placeResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            { signal: controller.signal }
          );
          if (placeResponse.ok) {
            const place = (await placeResponse.json()) as {
              city?: string;
              locality?: string;
              principalSubdivision?: string;
            };
            const area = place.city || place.locality || place.principalSubdivision;
            const region = place.principalSubdivision;
            if (area) {
              locationLabel =
                region && region !== area ? `${area}, ${region}` : area;
            }
          }
        } catch {
          // The forecast is still useful if the optional place lookup fails.
        }
      }

      if (id !== requestId.current) return;

      const weather: Weather = {
        current: {
          temperature: data.current.temperature_2m,
          apparent: data.current.apparent_temperature,
          code: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          wind: data.current.wind_speed_10m,
          uv: data.current.uv_index,
        },
        daily: data.daily.time.map((date, index) => ({
          date,
          code: data.daily.weather_code[index],
          high: data.daily.temperature_2m_max[index],
          low: data.daily.temperature_2m_min[index],
          rain: data.daily.precipitation_probability_max[index],
          sunrise: data.daily.sunrise[index],
          sunset: data.daily.sunset[index],
          uvMax: data.daily.uv_index_max[index],
          windMax: data.daily.wind_speed_10m_max[index],
        })),
      };
      const updated = new Date().toISOString();
      setState({
        weather,
        location: locationLabel,
        lastUpdated: updated,
        loading: false,
        error: '',
      });
      writeStorage('homehub-weather-cache', {
        key: cacheKey,
        weather,
        location: locationLabel,
        lastUpdated: updated,
      } satisfies WeatherCache);
    } catch (error) {
      if (controller.signal.aborted || id !== requestId.current) return;
      const code = (error as GeolocationPositionError)?.code;
      setState(previous => ({
        ...previous,
        loading: false,
        error: locationErrorMessage(error),
        location:
          previous.weather || !prefs.useDeviceLocation
            ? previous.location
            : code === 1
              ? 'Location permission needed'
              : 'Location unavailable',
      }));
    }
  }, [cacheKey, prefs.manualLocation, prefs.useDeviceLocation]);

  useEffect(() => {
    const cached = readCache(prefs);
    if (cached) {
      setState(previous => ({
        ...previous,
        weather: cached.weather,
        location: cached.location,
        lastUpdated: cached.lastUpdated,
      }));
    } else {
      setState(previous => ({
        ...previous,
        weather: null,
        loading: true,
        location: prefs.useDeviceLocation
          ? 'Finding your location…'
          : prefs.manualLocation?.label ?? 'Choose a location',
      }));
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [cacheKey, prefs, refresh]);

  return { ...state, refresh };
}
