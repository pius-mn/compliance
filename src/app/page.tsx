"use client";

import { useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { usePageData } from "../hooks/usePageData";
import DashboardView from "../views/DashboardView";
import { apiFetch } from "../utils/apiFetch";
import type { DashboardStatsResponse } from "../utils/dataSync";
import type { TechnicianDocument } from "../types";

export default function DashboardPage() {
  const {
    user,
    contractors,
    notifications,
    setViewingDoc,
    handleClearBroadcast,
    fetchDashboardStatsData,
    fetchNotificationsData,
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
      const stats = await fetchDashboardStatsData(userId ? String(userId) : undefined, contractorId || undefined);
      if (stats) {
        setDashboardStats(stats);
      }
    },
    [user, fetchDashboardStatsData]
  );

  // Lazy-load dashboard stats + notifications + pending documents
  usePageData(async () => {
    const userId = user?.role === "Field Technician" ? user.id : undefined;
    const [stats] = await Promise.all([
      fetchDashboardStatsData(userId ? String(userId) : undefined),
      fetchNotificationsData(),
      appState.fetchContractorsData(),
    ]);

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
