import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';

/**
 * Runs an async DB query and re-runs it whenever data changes (store revision) or `deps`
 * change. Keeps the previous data while reloading so lists don't flash empty.
 */
export function useDbQuery<T>(
  query: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): { data: T | undefined; error: unknown; loading: boolean } {
  const revision = useAppStore(state => state.revision);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    query()
      .then(result => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // `query` is intentionally excluded: callers pass inline closures; `deps` lists its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);

  return { data, error, loading };
}
