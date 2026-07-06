"use client";

import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useAppStates } from "../hooks/useAppStates";
import { useProjectActions } from "../hooks/useProjectActions";
import { useDocumentActions } from "../hooks/useDocumentActions";
import {
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
  fetchContractorsData,
  fetchUsersData,
  fetchWorkRolesData,
  fetchDocumentTypesData,
  fetchPredefinedMilestonesData,
  fetchPredefinedPrerequisitesData,
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

  handleLogin: (data: LoginData) => void;
  handleLogout: () => void;
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", message: string) => void;
  triggerToast: (type: "success" | "error", message: string) => void;
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

  const triggerBannerAlert = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
    const opts = { duration: 3000 };
    switch (type) {
      case "success":
        toast.success(message, opts);
        break;
      case "error":
        toast.error(message, opts);
        break;
      case "warning":
      case "info":
      default:
        toast(message, { ...opts, icon: type === "warning" ? "⚠️" : "ℹ️" });
        break;
    }
  }, []);

  const triggerToast = useCallback((type: "success" | "error", message: string) => {
    if (type === "success") {
      toast.success(message, { duration: 3500 });
    } else {
      toast.error(message, { duration: 3500 });
    }
  }, []);

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
      fetchContractorsData: () => fetchContractorsData(ds, API_BASE),
      fetchUsersData: () => fetchUsersData(ds, API_BASE),
      fetchWorkRolesData: () => fetchWorkRolesData(ds, API_BASE),
      fetchDocumentTypesData: () => fetchDocumentTypesData(ds, API_BASE),
      fetchPredefinedMilestonesData: () => fetchPredefinedMilestonesData(ds, API_BASE),
      fetchPredefinedPrerequisitesData: () => fetchPredefinedPrerequisitesData(ds, API_BASE),
    }),
    [ds, API_BASE]
  );

  const refetchData = useCallback(
    (collections: CollectionKey[]) => refetchCollections(ds, API_BASE, collections),
    [ds, API_BASE]
  );

  // ── Global auth:expired handler (debounced) ──────────────────────────────
  // When apiFetch detects a 401 (expired/invalid token), this listener fires
  // to log the user out and redirect to the login page with a banner message.
  // Because multiple in-flight requests may all return 401 simultaneously,
  // the handler is debounced: the first event triggers immediately, then
  // subsequent events are ignored for DEBOUNCE_MS. The gate resets after
  // that window so a brand-new session that later expires also gets handled.
  useEffect(() => {
    const DEBOUNCE_MS = 2000;
    let expiredTimer: ReturnType<typeof setTimeout> | null = null;

    const handleAuthExpired = () => {
      if (expiredTimer) return; // Still within the debounce window — ignore

      // Show a toast before logout — the Toaster lives in providers.tsx
      // (outside AppLayout), so it stays mounted even after the user is
      // redirected to the Login view and the toast remains visible.
      toast.error("Your session has expired. Please sign in again.", { duration: 5000, id: "session-expired" });
      handleLogout();

      // Open the gate again after DEBOUNCE_MS so a new session expiry
      // later on (login → token expires again) is still caught.
      expiredTimer = setTimeout(() => {
        expiredTimer = null;
      }, DEBOUNCE_MS);
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
      if (expiredTimer) clearTimeout(expiredTimer);
    };
  }, [handleLogout]);

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
      triggerToast,
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