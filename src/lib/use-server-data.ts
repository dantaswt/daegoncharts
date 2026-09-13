import { useState, useEffect, useCallback, useRef } from "react";

const LS_PREFIX = "dc_v2_";
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

function lsGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > DEFAULT_TTL * 2) return null; // purge after 1h
    return data as T;
  } catch {
    return null;
  }
}

function lsSet(key: string, data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

export function useServerData<T>(
  key: string,
  fetcher: () => Promise<T>,
): { data: T | null; isLoading: boolean; fromCache: boolean } {
  const [data, setData] = useState<T | null>(() => lsGet<T>(key));
  const [isLoading, setIsLoading] = useState(true);
  const [fromCache, setFromCache] = useState(() => lsGet<T>(key) !== null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetcher();
        if (!cancelled && mountedRef.current) {
          setData(result);
          setFromCache(false);
          lsSet(key, result);
        }
      } catch {
        // fetch failed — keep showing stale localStorage data
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    };

    run();
    return () => { cancelled = true; mountedRef.current = false; };
  }, [key]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      setFromCache(false);
      lsSet(key, result);
    } catch { /* keep stale */ }
    finally { setIsLoading(false); }
  }, [key]);

  return { data, isLoading, fromCache };
}
