import { useEffect, useState, useCallback, useRef } from "react";

type Fetcher = () => Promise<void>;

/**
 * usePageData — lazy data fetching hook.
 *
 * Calls the provided `fetcher` once when the component mounts.
 * Returns a `loading` flag and a `refresh` function to re-fetch.
 *
 * Optionally pass `enabled = false` to skip fetching until a condition is met.
 */
export function usePageData(fetcher: Fetcher, enabled = true) {
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetcher();
    } catch (err) {
      console.error("usePageData fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    // Avoid double-fetch in StrictMode
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refresh();
  }, [enabled, refresh]);

  return { loading, refresh };
}
