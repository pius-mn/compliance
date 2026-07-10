import { useEffect, useRef } from 'react';
import { User } from '../types';

/**
 * Maximum consecutive SSE errors before verifying the auth token.
 * The browser auto-reconnects EventSource on failure, so a transient
 * network blip causes 1-2 errors at most.  If we hit this threshold
 * the connection is persistently failing — likely an expired token.
 */
const MAX_SSE_ERRORS_BEFORE_AUTH_CHECK = 3;

interface AuditLog {
  id: number | string;
  action: string;
  targetType?: string;
  targetId?: number | string;
  userId?: number | string;
  details?: string;
  createdAt?: string;
}

interface Notification {
  id: number | string;
  title: string;
  message: string;
  type?: string;
  read?: boolean;
  createdAt?: string;
}

interface ComplianceFlag {
  id: number | string;
  targetType: string;
  targetId: number | string;
  ruleName: string;
  severity: string;
  status: string;
  description?: string;
  flaggedAt?: string;
  standard?: string;
}

/**
 * Hook to handle Server-Sent Events (SSE) for real-time updates.
 */
export function useSSE(
  user: User | null, 
  onAuditUpdate: (log: AuditLog, notification: Notification) => void, 
  onComplianceUpdate: (newFlags: ComplianceFlag[], updatedFlags: ComplianceFlag[]) => void
) {
  // Use refs to keep callbacks stable and avoid infinite reconnect loops
  const onAuditUpdateRef = useRef(onAuditUpdate);
  const onComplianceUpdateRef = useRef(onComplianceUpdate);
  const sseErrorCount = useRef(0);
  const authCheckInFlight = useRef(false);

  useEffect(() => {
    onAuditUpdateRef.current = onAuditUpdate;
  }, [onAuditUpdate]);

  useEffect(() => {
    onComplianceUpdateRef.current = onComplianceUpdate;
  }, [onComplianceUpdate]);

  useEffect(() => {
    if (!user) return;
    
    const API_BASE = "/api/v1";
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const eventSource = new EventSource(`${API_BASE}/sse?token=${token || ""}`);

    // Fresh start for this session — the old counter (if any) is from a
    // previous user session with a different (possibly expired) token.
    sseErrorCount.current = 0;
    authCheckInFlight.current = false;

    // Reset error counter on any successful message — means the connection works
    const resetErrorCount = () => { sseErrorCount.current = 0; };

    // Reset on successful open too, not just on messages — a reconnect
    // without data should still clear the error counter.
    eventSource.onopen = resetErrorCount;
    
    eventSource.addEventListener("audit_update", (event: MessageEvent) => {
      resetErrorCount();
      try {
        const payload = JSON.parse(event.data);
        onAuditUpdateRef.current(payload.log, payload.notification);
      } catch (err) {
        console.error("Error decoding SSE stream payload:", err);
      }
    });

    eventSource.addEventListener("compliance_update", (event: MessageEvent) => {
      resetErrorCount();
      try {
        const payload = JSON.parse(event.data);
        onComplianceUpdateRef.current(payload.newFlags || [], payload.updatedFlags || []);
      } catch (err) {
        console.error("Error decoding SSE compliance stream payload:", err);
      }
    });

    // The EventSource onerror fires when the connection fails (including 401).
    // We can't read the HTTP status from the error event, so we track
    // consecutive failures and verify the auth token after a threshold.
    eventSource.onerror = () => {
      sseErrorCount.current += 1;

      // After MAX consecutive errors, verify the token is still valid.
      // Multiple rapid errors = persistent failure (likely expired token),
      // not a transient network blip (which resolves in 1-2 retries).
      if (sseErrorCount.current >= MAX_SSE_ERRORS_BEFORE_AUTH_CHECK && !authCheckInFlight.current) {
        authCheckInFlight.current = true;

        const currentToken = localStorage.getItem("authToken");
        if (!currentToken) {
          window.dispatchEvent(new CustomEvent("auth:expired"));
          return;
        }

        fetch("/api/v1/auth/me", {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
        })
          .then((res) => {
            if (!res.ok) {
              window.dispatchEvent(new CustomEvent("auth:expired"));
            }
          })
          .catch(() => {
            // Network error — transient, don't logout
          })
          .finally(() => {
            authCheckInFlight.current = false;
          });
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user]);
}
