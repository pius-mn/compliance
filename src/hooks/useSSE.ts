import { useEffect, useRef } from 'react';
import { User } from '../types';

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
    
    eventSource.addEventListener("audit_update", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        onAuditUpdateRef.current(payload.log, payload.notification);
      } catch (err) {
        console.error("Error decoding SSE stream payload:", err);
      }
    });

    eventSource.addEventListener("compliance_update", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        onComplianceUpdateRef.current(payload.newFlags || [], payload.updatedFlags || []);
      } catch (err) {
        console.error("Error decoding SSE compliance stream payload:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [user?.id]); // Recreate only when the user ID changes
}
