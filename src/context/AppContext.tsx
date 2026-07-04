"use client";

import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from "react";
import { useAppStates } from "../hooks/useAppStates";
import { useProjectActions } from "../hooks/useProjectActions";
import { useDocumentActions } from "../hooks/useDocumentActions";
import {
  fetchReferenceData,
  fetchProjectsData,
  fetchTechniciansData,
  fetchEHSDocumentsData,
  fetchNotificationsData,
  fetchComplianceFlagsData,
  fetchAuditLogsData,
  fetchSitePhotosData,
  fetchMilestonesData,
  fetchDashboardStatsData,
  refetchCollections,
} from "../utils/dataSync";
import type { DashboardStatsResponse, CollectionKey, DataSyncStates } from "../utils/dataSync";
import type { User } from "../types";

// Login API returns user + optional token
interface LoginData {
  user: User;
  token?: string;
}

// Context value type — uses index signature for dynamic state/action spread
interface AppContextValue {
  user: User | null;
  authToken: string | null;
  isDarkMode: boolean;
  isSidebarOpen: boolean;
  isNotificationsDrawerOpen: boolean;
  sysAlert: { type: "success" | "error" | "info" | "warning"; message: string } | null;

  handleLogin: (data: LoginData) => void;
  handleLogout: () => void;
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", message: string) => void;
  refetchData: (collections: CollectionKey[]) => Promise<void>;

  // Individual lazy fetchers — pages can call these on mount
  // Optional params object allows pagination/search/filter: { page, limit, search, status, sortBy, sortDir }
  fetchProjectsData: (params?: Record<string, string>) => Promise<void>;
  fetchTechniciansData: (params?: Record<string, string>) => Promise<void>;
  fetchEHSDocumentsData: (params?: Record<string, string>) => Promise<void>;
  fetchNotificationsData: () => Promise<void>;
  fetchComplianceFlagsData: () => Promise<void>;
  fetchAuditLogsData: () => Promise<void>;
  fetchSitePhotosData: () => Promise<void>;
  fetchMilestonesData: () => Promise<void>;

  // Dashboard stats fetcher — returns aggregated stats from the server
  fetchDashboardStatsData: (userId?: string, contractorId?: string) => Promise<DashboardStatsResponse | null>;

  // All dynamic states, setters, and actions from useAppStates/useProjectActions/useDocumentActions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const AppContext = createContext<AppContextValue>(null as unknown as AppContextValue);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const states = useAppStates();
  const API_BASE = "/api/v1";

  // Cleanup ref for the banner timeout
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBannerAlert = useCallback(
    (type: "success" | "error" | "info" | "warning", message: string) => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      states.setSysAlert({ type, message });
      alertTimeoutRef.current = setTimeout(() => {
        states.setSysAlert(null);
        alertTimeoutRef.current = null;
      }, 3000);
    },
    [states.setSysAlert]
  );

  const handleLogin = useCallback(
    (loginData: LoginData) => {
      const { user, token } = loginData;
      states.setUser(user);
      states.setAuthToken(token || null);
      localStorage.setItem("user", JSON.stringify(user));
      if (token) {
        localStorage.setItem("authToken", token);
      } else {
        localStorage.removeItem("authToken");
      }
    },
    [states.setUser, states.setAuthToken]
  );

  const handleLogout = useCallback(() => {
    states.setUser(null);
    states.setAuthToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    localStorage.removeItem("rememberedEmail");
  }, [states.setUser, states.setAuthToken]);

  // --- Individual lazy fetchers (pages use these to load their own data) ---
  const ds = states as unknown as DataSyncStates;
  const lazyFetchers = useMemo(
    () => ({
      fetchProjectsData: (params?: Record<string, string>) => fetchProjectsData(ds, API_BASE, params),
      fetchTechniciansData: (params?: Record<string, string>) => fetchTechniciansData(ds, API_BASE, params),
      fetchEHSDocumentsData: (params?: Record<string, string>) => fetchEHSDocumentsData(ds, API_BASE, params),
      fetchNotificationsData: () => fetchNotificationsData(ds, API_BASE),
      fetchComplianceFlagsData: () => fetchComplianceFlagsData(ds, API_BASE),
      fetchAuditLogsData: () => fetchAuditLogsData(ds, API_BASE),
      fetchSitePhotosData: () => fetchSitePhotosData(ds, API_BASE),
      fetchMilestonesData: () => fetchMilestonesData(ds, API_BASE),
      fetchDashboardStatsData: (userId?: string, contractorId?: string) => fetchDashboardStatsData(API_BASE, userId, contractorId),
    }),
    [ds, API_BASE]
  );

  // ── Targeted re-fetch (replaces monolithic sync for most mutations) ──────
  const refetchData = useCallback(
    async (collections: CollectionKey[]) => {
      await refetchCollections(ds, API_BASE, collections);
    },
    [ds, API_BASE]
  );



  // --- Lightweight initial sync: fetch reference data + notifications on mount ---
  const initialFetchRef = useRef(false);
  useEffect(() => {
    // Reset ref on logout so re-login re-fetches data
    if (!states.user) {
      initialFetchRef.current = false;
      return;
    }
    if (!initialFetchRef.current) {
      initialFetchRef.current = true;
      const ds = states as unknown as DataSyncStates;
      Promise.all([
        fetchReferenceData(ds, API_BASE),
        fetchNotificationsData(ds, API_BASE), // header shows notification badge
      ]);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.user]);

  // Single call per hook — no double invocation
  const projectActions = useProjectActions(states as unknown as Parameters<typeof useProjectActions>[0], API_BASE, triggerBannerAlert, refetchData);
  const documentActions = useDocumentActions(states as unknown as Parameters<typeof useDocumentActions>[0], API_BASE, triggerBannerAlert, refetchData);

  const value = useMemo(
    () => ({
      ...states,
      ...projectActions,
      ...documentActions,
      ...lazyFetchers,
      handleLogin,
      handleLogout,
      triggerBannerAlert,
      refetchData,
    }),
    [
      states,
      projectActions,
      documentActions,
      lazyFetchers,
      handleLogin,
      handleLogout,
      triggerBannerAlert,
      refetchData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
