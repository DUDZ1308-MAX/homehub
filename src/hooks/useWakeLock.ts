import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function useWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [supported] = useState(() => 'wakeLock' in navigator);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // The lock may already have been released by the browser.
      }
    }
    setActive(false);
  }, []);

  const request = useCallback(async () => {
    if (!supported) return;
    if (sentinelRef.current) return;
    try {
      const sentinel = await (navigator as WakeLockNavigator).wakeLock?.request(
        'screen'
      );
      if (!sentinel) return;
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
        setActive(false);
      });
      setActive(true);
    } catch {
      setActive(false);
    }
  }, [supported]);

  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }
    void request();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabledRef.current) {
        void request();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void release();
    };
  }, [enabled, release, request]);

  return { active, supported, request, release };
}
