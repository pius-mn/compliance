"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Syncs a page number with a URL search parameter.
 *
 * - Initialises with `defaultValue` on both server and client so the
 *   first render always matches (no hydration mismatch).
 * - After hydration, reads the actual `?key=value` from the URL and
 *   syncs state (one-time effect).
 * - When the page changes via `setPage`, updates the URL in-place (replace).
 * - `defaultValue` is omitted from the URL for clean links.
 *
 * Safe to use in any `"use client"` page — does not rely on `useSearchParams`,
 * so no Suspense boundary is needed.
 */
export function usePageParam(key = "page", defaultValue = 1) {
  const pathname = usePathname();
  const router = useRouter();

  const [page, setPageInternal] = useState(defaultValue);

  // Hydrate the actual page value from the URL after first render.
  // This avoids reading window.location in the useState initializer,
  // which would cause a hydration mismatch (server has no location).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(key);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        setPageInternal(parsed);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPage = useCallback(
    (newPage: number) => {
      setPageInternal(newPage);
      const params = new URLSearchParams(window.location.search);
      if (newPage === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, String(newPage));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [key, defaultValue, pathname, router]
  );

  return [page, setPage] as const;
}
