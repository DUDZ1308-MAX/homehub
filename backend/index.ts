import { router, json, error } from '@appdeploy/sdk';

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'GET /api/radio/stream': [
    async () => {
      const playlistUrl = 'https://ice23.securenetsystems.net/REGI959.m3u';
      try {
        const response = await fetch(playlistUrl, {
          headers: {
            Accept: 'audio/x-mpegurl, application/x-mpegurl, text/plain, */*',
            'User-Agent': 'HomeHub Radio Player',
          },
          redirect: 'follow',
        });
        if (!response.ok) {
          return error('UCB Regina playlist is temporarily unavailable', 502);
        }

        const playlist = (await response.text()).replace(/^\\uFEFF/, '').trim();
        const lines = playlist
          .split(/\\r?\\n/)
          .map(line => line.trim())
          .filter(Boolean);
        const streamEntry = lines.find(line =>
          !line.startsWith('#') && /^https?:\/\//i.test(line)
        );
        if (!streamEntry) {
          return error('UCB Regina playlist did not contain a valid audio URL', 502);
        }

        const streamUrl = new URL(streamEntry, response.url || playlistUrl);
        if (!['http:', 'https:'].includes(streamUrl.protocol)) {
          return error('UCB Regina returned an unsupported stream URL', 502);
        }
        // Avoid mixed-content blocking when a provider playlist contains an HTTP URL.
        if (streamUrl.protocol === 'http:') streamUrl.protocol = 'https:';

        const isHls =
          /\\.m3u8(?:$|[?#])/i.test(streamUrl.href) ||
          /#EXT-X-(?:TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE|PART)/i.test(playlist);

        return json({
          streamUrl: streamUrl.toString(),
          isHls,
          playlistUrl,
          playerMode: isHls ? 'hls' : 'native-audio',
        });
      } catch {
        return error('Unable to resolve the UCB Regina audio stream', 502);
      }
    },
  ],
  'GET /api/weather': [
    async () => {
      try {
        const url =
          'https://api.open-meteo.com/v1/forecast?latitude=50.4452&longitude=-104.6189&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=America%2FRegina&forecast_days=7';
        const response = await fetch(url);
        if (!response.ok) return error('Weather provider unavailable', 502);
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
          hourly: {
            time: string[];
            temperature_2m: number[];
            weather_code: number[];
            precipitation_probability: number[];
          };
        };
        return json({
          current: {
            temperature: data.current.temperature_2m,
            apparent: data.current.apparent_temperature,
            code: data.current.weather_code,
            humidity: data.current.relative_humidity_2m,
            wind: data.current.wind_speed_10m,
            uv: data.current.uv_index,
          },
          daily: data.daily.time.map((date, i) => ({
            date,
            code: data.daily.weather_code[i],
            high: data.daily.temperature_2m_max[i],
            low: data.daily.temperature_2m_min[i],
            rain: data.daily.precipitation_probability_max[i],
            sunrise: data.daily.sunrise[i],
            sunset: data.daily.sunset[i],
            uvMax: data.daily.uv_index_max[i],
            windMax: data.daily.wind_speed_10m_max[i],
          })),
          hourly: data.hourly.time.slice(0, 24).map((time, i) => ({
            time,
            temperature: data.hourly.temperature_2m[i],
            code: data.hourly.weather_code[i],
            rain: data.hourly.precipitation_probability[i],
          })),
        });
      } catch {
        return error('Unable to retrieve weather right now', 502);
      }
    },
  ],
});
