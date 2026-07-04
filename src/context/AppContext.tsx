"use client";

import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from "react";
import { useAppStates } from "../hooks/useAppStates";
import { useProjectActions } from "../hooks/useProjectActions";
import { useDocumentActions } from "../hooks/useDocumentActions";
import {
  fetchReferenceData,
  fetchNotificationsData,
  refetchCollections,
  // Lazy fetchers
  fetchProjectsData,
  fetchTechniciansData,
  fetchEHSDocumentsData,
  fetchComplianceFlagsData,
  fetchAuditLogsData,
  fetchSitePhotosData,
  fetchMilestonesData,
  fetchDashboardStatsData,
} from "../utils/dataSync";

import type { DashboardStatsResponse, CollectionKey, DataSyncStates } from "../utils/dataSync";
import type { User } from "../types";

interface LoginData {
  user: User;
  token?: string;
}

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

  // Lazy data fetchers
  fetchProjectsData: (params?: Record<string, string>) => Promise<void>;
  fetchTechniciansData: (params?: Record<string, string>) => Promise<void>;
  fetchEHSDocumentsData: (params?: Record<string, string>) => Promise<void>;
  fetchNotificationsData: () => Promise<void>;
  fetchComplianceFlagsData: () => Promise<void>;
  fetchAuditLogsData: () => Promise<void>;
  fetchSitePhotosData: () => Promise<void>;
  fetchMilestonesData: () => Promise<void>;
  fetchDashboardStatsData: (userId?: string, contractorId?: string) => Promise<DashboardStatsResponse | null>;

  // Dynamic states & actions from hooks
  [key: string]: any;
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const states = useAppStates();
  const API_BASE = "/api/v1";

  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerBannerAlert = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }

    states.setSysAlert({ type, message });
    alertTimeoutRef.current = setTimeout(() => {
      states.setSysAlert(null);
      alertTimeoutRef.current = null;
    }, 3000);
  }, [states.setSysAlert]);

  const handleLogin = useCallback(({ user, token }: LoginData) => {
    states.setUser(user);
    states.setAuthToken(token ?? null);

    localStorage.setItem("user", JSON.stringify(user));
    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  }, [states.setUser, states.setAuthToken]);

  const handleLogout = useCallback(() => {
    states.setUser(null);
    states.setAuthToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    localStorage.removeItem("rememberedEmail");
  }, [states.setUser, states.setAuthToken]);

  // DataSync states cast (once)
  const ds = useMemo(() => states as unknown as DataSyncStates, [states]);

  // Lazy fetchers – stable reference
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
      fetchDashboardStatsData: (userId?: string, contractorId?: string) =>
        fetchDashboardStatsData(API_BASE, userId, contractorId),
    }),
    [ds, API_BASE]
  );

  const refetchData = useCallback(
    (collections: CollectionKey[]) => refetchCollections(ds, API_BASE, collections),
    [ds, API_BASE]
  );

  // Initial data sync (reference + notifications)
  const initialFetchRef = useRef(false);

  useEffect(() => {
    if (!states.user) {
      initialFetchRef.current = false;
      return;
    }

    if (initialFetchRef.current) return;

    initialFetchRef.current = true;

    Promise.allSettled([
      fetchReferenceData(ds, API_BASE),
      fetchNotificationsData(ds, API_BASE),
    ]).catch(console.error); // Prevent unhandled promise rejection
  }, [states.user, ds, API_BASE]);

  // Project & Document actions
  const projectActions = useProjectActions(
    states as unknown as Parameters<typeof useProjectActions>[0],
    API_BASE,
    triggerBannerAlert,
    refetchData
  );

  const documentActions = useDocumentActions(
    states as unknown as Parameters<typeof useDocumentActions>[0],
    API_BASE,
    triggerBannerAlert,
    refetchData
  );

  // Final context value – minimized dependency array + stable objects
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