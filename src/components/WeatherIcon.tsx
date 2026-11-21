import {
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';

export function WeatherIcon({ code, size = 24 }: { code: number; size?: number }) {
  if ([0, 1].includes(code)) return <Sun size={size} />;
  if ([2, 3, 45, 48].includes(code)) return <CloudSun size={size} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle size={size} />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <CloudRain size={size} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={size} />;
  if ([95, 96, 99].includes(code)) return <CloudRain size={size} />;
  return <Cloud size={size} />;
}
