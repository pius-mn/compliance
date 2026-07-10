"use client";

import React, { createContext, useContext, useMemo, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useAppStates } from "../hooks/useAppStates";
import { apiFetch } from "../utils/apiFetch";
import { useProjectActions } from "../hooks/useProjectActions";
import { useDocumentActions } from "../hooks/useDocumentActions";
import type { User, Contractor, WorkRole, DocumentType } from "../types";

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

  // Dynamic states & actions from hooks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const states = useAppStates();
  const { setUser, setAuthToken } = states;
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
    setUser(user);
    setAuthToken(token ?? null);

    localStorage.setItem("user", JSON.stringify(user));
    if (token) {
      localStorage.setItem("authToken", token);
    } else {
      localStorage.removeItem("authToken");
    }
  }, [setUser, setAuthToken]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    localStorage.removeItem("rememberedEmail");
  }, [setUser, setAuthToken]);

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

  // ── Global reference data fetching ──────────────────────────────────
  // Load contractors, users, work roles, and document types once at the app
  // level so they're available on every page without per-page fetching.
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [contrRes, usersRes, rolesRes, docTypesRes] = await Promise.all([
          apiFetch("/api/v1/contractors"),
          apiFetch("/api/v1/users"),
          apiFetch("/api/v1/work-roles"),
          apiFetch("/api/v1/document-types"),
        ]);

        if (contrRes.ok) {
          const data = await contrRes.json() as Contractor[];
          states.setContractors(Array.isArray(data) ? data : []);
        }

        if (usersRes.ok) {
          const data = await usersRes.json() as User[];
          states.setAllUsers(Array.isArray(data) ? data : []);
        }

        if (rolesRes.ok) {
          const data = await rolesRes.json() as WorkRole[];
          states.setAllRoles(Array.isArray(data) ? data : []);
        }

        if (docTypesRes.ok) {
          const data = await docTypesRes.json() as DocumentType[];
          states.setAllDocumentTypes(Array.isArray(data) ? data : []);
        }
      } catch {
        // Non-critical — components gracefully degrade if data isn't loaded
      }
    };

    fetchReferenceData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project & Document actions – called at top level (Rules of Hooks compliant)
  const projectActions = useProjectActions(
    states as unknown as Parameters<typeof useProjectActions>[0],
    API_BASE,
    triggerBannerAlert
  );

  const documentActions = useDocumentActions(
    states as unknown as Parameters<typeof useDocumentActions>[0],
    API_BASE,
    triggerBannerAlert
  );

  // Final context value – minimized dependency array + stable objects
  const value = useMemo(
    () => ({
      ...states,
      ...projectActions,
      ...documentActions,
      handleLogin,
      handleLogout,
      triggerBannerAlert,
      triggerToast,
    }),
    [
      states,
      projectActions,
      documentActions,
      handleLogin,
      handleLogout,
      triggerBannerAlert,
      triggerToast,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);