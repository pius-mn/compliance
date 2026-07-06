/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared utilities for AI-powered services (document processor, hazard
 * analyzer, etc.). Extracted to avoid duplicating cache and timeout logic
 * across multiple Gemini-wrapping modules.
 */

// ─── Timeout wrapper ─────────────────────────────────────────────────────────

/**
 * Race a promise against a timeout so the caller never waits indefinitely
 * when the upstream service is slow or hung.
 *
 * The internal timer is always cleared on completion so the process can exit
 * cleanly without lingering handles.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout,
  ]);
}

// ─── Generic TTL cache ───────────────────────────────────────────────────────

/**
 * Simple in-memory cache that expires entries after a fixed TTL.
 *
 * - Bounded at `maxEntries` (default 50) — evicts oldest entry when full.
 * - Generic over the value type so it works with any result shape.
 * - Not shared across serverless instances; useful for per-process caching
 *   within a single Node.js server or development hot-reload cycles.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiry: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlSeconds: number, maxEntries = 50) {
    this.ttlMs = ttlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  /** Returns the cached value (or null if missing / expired). */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Stores a value with the cache's TTL, evicting the oldest entry if full. */
  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiry: Date.now() + this.ttlMs });
  }

  /** Number of entries currently in the cache. */
  get size(): number {
    return this.store.size;
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }
}

// ─── Retry helpers ───────────────────────────────────────────────────────────

/**
 * Check whether an error is worth retrying (transient server issues or
 * client-side timeouts).
 */
export function isRetryableError(error: unknown): {
  retryable: boolean;
  isTimeout: boolean;
} {
  const msg = (error as { message?: string })?.message || "";
  const isTimeout = msg.includes("timed out");
  const retryable =
    isTimeout ||
    /503|UNAVAILABLE|high demand|capacity|overloaded/i.test(msg);
  return { retryable, isTimeout };
}

/**
 * Simple back-off: 500ms, 1 000ms, 1 500ms, …
 * Faster than the default exponential-style back-off used before.
 */
export function getRetryDelay(attempt: number): number {
  return attempt * 500;
}
