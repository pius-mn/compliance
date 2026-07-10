"use client";

import { useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { usePageData } from "../hooks/usePageData";
import DashboardView from "../views/DashboardView";
import { apiFetch } from "../utils/apiFetch";
import type { TechnicianDocument } from "../types";

// Dashboard stats shape returned by the server
export interface DashboardStatsResponse {
  user: { id: string; name: string; role: string; isSafaricom: boolean; isContractor: boolean; contractorId: string | null };
  contractorFilter: string | null;
  contractorName: string | null;
  projectStats: { total: number; completed: number; inProgress: number; planning: number; onHold: number; totalBudget: number };
  documentStats: { total: number; approved: number; pendingContractor: number; pendingCentral: number; rejected: number };
  technicianStats: { total: number; active: number; warningNeeded: number; avgScore: number };
  milestoneStats: { total: number; completed: number; inProgress: number; pending: number; blocked: number; completionRate: number };
  complianceStats: { total: number; active: number; resolved: number; highSeverity: number; mediumSeverity: number; lowSeverity: number };
  complianceTrend: Array<{ month: string; created: number; resolved: number }>;
  milestoneCompletedTrend: Array<{ month: string; created: number; resolved: number }>;
}

async function fetchDashboardStats(urlBase: string, userId?: string, contractorId?: string): Promise<DashboardStatsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (contractorId) params.set("contractorId", contractorId);
    const qs = params.toString();
    const url = qs ? `${urlBase}/dashboard/stats?${qs}` : `${urlBase}/dashboard/stats`;
    const res = await apiFetch(url);
    if (res.ok) {
      return await res.json();
    }
    console.error("Failed to fetch dashboard stats");
    return null;
  } catch (err) {
    console.error("Failed to fetch dashboard stats:", err);
    return null;
  }
}

export default function DashboardPage() {
  const {
    user,
    contractors,
    notifications,
    setViewingDoc,
    handleClearBroadcast,
    ...appState
  } = useApp();

  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<TechnicianDocument[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  const API_BASE = "/api/v1";

  // Fetch dashboard stats with optional contractor filter
  const loadStats = useCallback(
    async (contractorId?: string | null) => {
      const userId = user?.role === "Field Technician" ? user.id : undefined;
      const stats = await fetchDashboardStats(API_BASE, userId ? String(userId) : undefined, contractorId || undefined);
      if (stats) {
        setDashboardStats(stats);
      }
    },
    [user, API_BASE]
  );

  // Lazy-load dashboard stats + pending documents
  usePageData(async () => {
    const userId = user?.role === "Field Technician" ? user.id : undefined;
    const stats = await fetchDashboardStats(API_BASE, userId ? String(userId) : undefined);

    if (stats) {
      setDashboardStats(stats);
    }

    // Fetch only pending documents for the sidebar audit queue
    try {
      const docRes = await apiFetch(`${API_BASE}/ehs/documents?status=Pending&limit=3&sort=uploadDate`);
      if (docRes.ok) {
        const docs = await docRes.json();
        setPendingDocuments(Array.isArray(docs) ? docs : []);
      }
    } catch (err) {
      console.error("Failed to fetch pending documents for dashboard:", err);
    }
  });

  const handleContractorChange = useCallback(
    (contractorId: string | null) => {
      setSelectedContractorId(contractorId);
      loadStats(contractorId);
    },
    [loadStats]
  );

  return (
    <DashboardView
      user={user}
      {...appState}
      contractors={contractors}
      notifications={notifications}
      setViewingDoc={setViewingDoc}
      handleClearBroadcast={handleClearBroadcast}
      dashboardStats={dashboardStats}
      pendingDocuments={pendingDocuments}
      selectedContractorId={selectedContractorId}
      onContractorChange={handleContractorChange}
    />
  );
}
