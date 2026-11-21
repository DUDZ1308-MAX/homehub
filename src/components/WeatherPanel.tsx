import { CloudOff, CloudRain, Pause, Play } from 'lucide-react';
import type { Prefs, Weather } from '../types';
import {
  dayLabel,
  hourLabel,
  relativeTime,
  temperature,
  temperatureUnit,
  uvLabel,
  weatherLabel,
  weatherMood,
  wind,
  windUnit,
} from '../lib/homehub';
import { WeatherIcon } from './WeatherIcon';

type WeatherPanelProps = {
  now: Date;
  weather: Weather | null;
  weatherError: string;
  weatherLocation: string;
  lastUpdated: string | null;
  loading: boolean;
  motionPaused: boolean;
  prefs: Prefs;
  onToggleMotion: () => void;
  onRetry: () => void;
};

export function WeatherPanel({
  now,
  weather,
  weatherError,
  weatherLocation,
  lastUpdated,
  loading,
  motionPaused,
  prefs,
  onToggleMotion,
  onRetry,
}: WeatherPanelProps) {
  const unit = temperatureUnit(prefs.tempUnit);
  const windLabel = windUnit(prefs.windUnit);

  return (
    <article
      className={`panel weather-panel ${
        weather ? `weather-${weatherMood(weather.current.code)}` : 'weather-cloudy'
      }`}
    >
      <div
        className={`weather-scene ${motionPaused ? 'motion-paused' : ''}`}
        aria-hidden="true"
      />
      {weather ? (
        <div className="weather-dashboard-grid">
          <div className="weather-topline weather-dashboard-header">
            <div>
              <span className="eyebrow">LOCAL WEATHER</span>
              <h2>{weatherLocation}</h2>
              <p>
                {now.toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="weather-heading-actions">
              <div className="weather-live-badge">
                <span /> Live
              </div>
              <button
                className="weather-motion-toggle"
                type="button"
                onClick={onToggleMotion}
                aria-label={
                  motionPaused
                    ? 'Resume weather animation'
                    : 'Pause weather animation'
                }
                title={motionPaused ? 'Resume animation' : 'Pause animation'}
              >
                {motionPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
            </div>
          </div>

          <div className="weather-current-card">
            <div className="weather-hero-condition">
              <WeatherIcon code={weather.current.code} size={76} />
              <div className="weather-current-copy">
                <div className="temperature">
                  {temperature(weather.current.temperature, prefs.tempUnit)}°
                  <small>{unit}</small>
                </div>
                <strong>{weatherLabel(weather.current.code)}</strong>
                <span>
                  Feels like{' '}
                  {temperature(weather.current.apparent, prefs.tempUnit)}°{unit}
                </span>
              </div>
            </div>
            <div className="weather-current-range">
              <span>Today's high / low</span>
              <strong>
                {temperature(
                  weather.daily[0]?.high ?? weather.current.temperature,
                  prefs.tempUnit
                )}
                °{' '}
                <small>
                  /{' '}
                  {temperature(
                    weather.daily[0]?.low ?? weather.current.temperature,
                    prefs.tempUnit
                  )}
                  °
                </small>
              </strong>
              <span>Current conditions in your area</span>
            </div>
          </div>

          <div className="weather-metric-stack">
            <div className="weather-metric-card">
              <span className="weather-metric-label">UV INDEX</span>
              <strong>{weather.current.uv.toFixed(1)}</strong>
              <em>{uvLabel(weather.current.uv)}</em>
              <div className="weather-meter">
                <i
                  style={{
                    width:
                      Math.min(
                        100,
                        Math.max(0, (weather.current.uv / 11) * 100)
                      ) + '%',
                  }}
                />
              </div>
            </div>
            <div className="weather-metric-card weather-wind-card">
              <span className="weather-metric-label">WIND</span>
              <strong>
                {wind(weather.current.wind, prefs.windUnit)} <small>{windLabel}</small>
              </strong>
              <em>
                Today's max{' '}
                {wind(
                  weather.daily[0]?.windMax ?? weather.current.wind,
                  prefs.windUnit
                )}{' '}
                {windLabel}
              </em>
            </div>
            <div className="weather-metric-card">
              <span className="weather-metric-label">HUMIDITY</span>
              <strong>
                {weather.current.humidity}
                <small>%</small>
              </strong>
              <em>Relative humidity</em>
            </div>
            <div className="weather-metric-card weather-sun-card">
              <span className="weather-metric-label">SUNRISE &amp; SUNSET</span>
              <div>
                <span>Sunrise</span>
                <strong>
                  {weather.daily[0]?.sunrise
                    ? hourLabel(weather.daily[0].sunrise)
                    : '—'}
                </strong>
              </div>
              <div>
                <span>Sunset</span>
                <strong>
                  {weather.daily[0]?.sunset
                    ? hourLabel(weather.daily[0].sunset)
                    : '—'}
                </strong>
              </div>
            </div>
          </div>

          <div className="weather-week-section">
            <div className="weather-section-heading">
              <strong>7-day forecast</strong>
              <span>Daily outlook · High / Low</span>
            </div>
            <div className="forecast">
              {weather.daily.slice(0, 7).map((day, index) => (
                <div className="forecast-day" key={day.date}>
                  <span>{index === 0 ? 'Today' : dayLabel(day.date)}</span>
                  <WeatherIcon code={day.code} size={21} />
                  <strong>
                    {temperature(day.high, prefs.tempUnit)}°{' '}
                    <small>{temperature(day.low, prefs.tempUnit)}°</small>
                  </strong>
                  <em>
                    <CloudRain size={10} /> {Math.round(day.rain)}%
                  </em>
                </div>
              ))}
            </div>
          </div>
          <div className="weather-source-note">
            {weatherError ? (
              <span className="weather-warning">
                {weatherError} Showing the last saved forecast
                {lastUpdated ? ` from ${relativeTime(lastUpdated, now)}` : ''}.
              </span>
            ) : (
              <>
                Weather for {weatherLocation}
                {lastUpdated ? ` · Updated ${relativeTime(lastUpdated, now)}` : ''}
                {' · '}
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open-Meteo
                </a>
                {loading ? ' · Refreshing…' : ''}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-weather">
          <CloudOff size={28} />
          <span>
            {loading ? 'Finding your local forecast…' : weatherError || 'Weather is unavailable.'}
          </span>
          <button className="weather-motion-toggle" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </article>
  );
}
