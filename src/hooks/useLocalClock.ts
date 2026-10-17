import { useEffect, useState } from 'react';
import { currentTimeISO, todayISO } from '@/lib/dates';

export function useLocalClock(): { date: string; time: string } {
  const [clock, setClock] = useState(() => ({ date: todayISO(), time: currentTimeISO() }));

  useEffect(() => {
    let interval = 0;
    const refresh = () => setClock({ date: todayISO(), time: currentTimeISO() });
    const firstTick = window.setTimeout(() => {
      refresh();
      interval = window.setInterval(refresh, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, []);

  return clock;
}
