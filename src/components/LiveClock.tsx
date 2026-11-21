import { useEffect, useState } from 'react';

export function LiveClock({ clock24 }: { clock24: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="clock-panel" aria-label="Current time">
      <div className="clock-time">
        {now.toLocaleTimeString([], {
          hour: clock24 ? '2-digit' : '2-digit',
          minute: '2-digit',
          hour12: !clock24,
        })}
      </div>
      <div className="clock-seconds" aria-hidden="true">
        {String(now.getSeconds()).padStart(2, '0')} <span>SECONDS</span>
      </div>
    </div>
  );
}
