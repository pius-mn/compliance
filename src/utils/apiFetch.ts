/**
 * apiFetch — JWT-persistent fetch wrapper.
 *
 * Reads the auth token from localStorage at call time (not from React state),
 * so the Authorization header is always injected — even on the very first
 * request before React state has hydrated from localStorage.
 *
 * Automatically detects 401 (Unauthorized) responses and dispatches a custom
 * `auth:expired` event on the window so the app can log out the user gracefully.
 *
 * Usage:
 *   apiFetch('/api/v1/projects', { method: 'POST', body: JSON.stringify(data) })
 */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  // Merge caller-supplied headers on top; caller can override Authorization if needed.
  const mergedHeaders: HeadersInit = {
    ...authHeader,
    ...(init.headers as Record<string, string> | undefined),
  };

  return fetch(url, { ...init, headers: mergedHeaders }).then(async (res) => {
    // Detect expired / invalid tokens — 401 with "Unauthorized" body
    if (res.status === 401 && typeof window !== "undefined") {
      const body = await res.clone().json().catch(() => ({}));
      if (body?.error === "Unauthorized") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }
    return res;
  });
}

/**
 * Convenience wrapper that also sets Content-Type: application/json
 * and serializes `body` if it's an object.
 */
export function apiFetchJson(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<Response> {
  const { body, ...rest } = init;
  return apiFetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers as Record<string, string> | undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Paginated fetch: call an API endpoint with page/limit params
 * and return the parsed data along with the X-Total-Count header value.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function apiFetchPage<T>(
  baseUrl: string,
  page: number,
  limit: number,
  extraParams: Record<string, string> = {}
): Promise<PaginatedResult<T>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), ...extraParams });
  const res = await apiFetch(`${baseUrl}?${params.toString()}`);
  if (!res.ok) {
    console.error(`Failed to fetch ${baseUrl}: ${res.status}`);
    return { data: [], total: 0, page, limit };
  }
  const data: T[] = await res.json();
  const total = parseInt(res.headers.get("X-Total-Count") || "0", 10);
  return { data: Array.isArray(data) ? data : [], total, page, limit };
}
