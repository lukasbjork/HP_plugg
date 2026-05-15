// Hook för att hämta och casha statistik
import { useState, useEffect } from 'react';
import { fetchStats } from '../lib/api';
import type { StatsResponse } from '../lib/types';

export function useStats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda statistik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return { stats, loading, error, reload: load };
}
