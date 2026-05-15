// Hook för nedräkningstimer (används i provsimuleringsläget)
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTimerReturn {
  secondsLeft: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: (seconds: number) => void;
  elapsed: number;
}

export function useTimer(initialSeconds: number): UseTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = useCallback(() => {
    setIsRunning(true);
    setStartTime(Date.now());
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    clear();
  }, []);

  const reset = useCallback((seconds: number) => {
    clear();
    setSecondsLeft(seconds);
    setIsRunning(false);
    setStartTime(null);
  }, []);

  useEffect(() => {
    if (!isRunning) { clear(); return; }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clear();
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clear;
  }, [isRunning]);

  const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  return { secondsLeft, isRunning, start, pause, reset, elapsed };
}
