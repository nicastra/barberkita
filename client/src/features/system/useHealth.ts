import { useCallback, useEffect, useState } from 'react';

import { getHealth, type HealthResponse } from '@/api/health';

export type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: HealthResponse }
  | { status: 'error' };

export interface UseHealthResult {
  state: HealthState;
  refresh: () => Promise<void>;
}

export function useHealth(): UseHealthResult {
  const [state, setState] = useState<HealthState>({ status: 'loading' });

  const refresh = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });

    try {
      const health = await getHealth();
      setState({ status: 'ready', health });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, refresh };
}
