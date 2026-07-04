"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Syncs a page number with a URL search parameter.
 *
 * - On mount, reads `?key=value` from the URL to initialise state.
 * - When the page changes via `setPage`, updates the URL in-place (replace).
 * - `defaultValue` is omitted from the URL for clean links.
 *
 * Safe to use in any `"use client"` page — does not rely on `useSearchParams`,
 * so no Suspense boundary is needed.
 */
export function usePageParam(key = "page", defaultValue = 1) {
  const pathname = usePathname();
  const router = useRouter();

  const [page, setPageInternal] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get(key);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
      }
    }
    return defaultValue;
  });

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
