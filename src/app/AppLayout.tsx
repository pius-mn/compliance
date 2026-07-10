"use client";

import React, { Suspense, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

// Views
import Login from "../views/Login";

// Components
import { Sidebar } from "../components/Sidebar";
import { NotificationsDrawer } from "../components/NotificationsDrawer";
import { MobileNav } from "../components/MobileNav";
import { UploadDocumentForm } from "../components/UploadDocumentModal";
import { useApp } from "../context/AppContext";
import { useSSE } from "../hooks/useSSE";
import AppHeader from "../components/AppHeader";
import LoadingFallback from "../components/LoadingFallback";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    isDarkMode,
    isSidebarOpen,
    setIsSidebarOpen,
    isNotificationsDrawerOpen,
    setIsNotificationsDrawerOpen,
    notifications,
    setNotifications,
    documents,
    handleLogout,
    handleLogin,
    handleSubmitDocument,
    ...appState
  } = useApp();

  const pathname = usePathname();

  const activeTab = pathname === "/" || pathname === "/dashboard" ? "dashboard" : pathname.replace(/^\//, "");

  // Real-time safety updates
  useSSE(
    user,
    (log, notification) => {
      appState.setAuditLogs((prev: Record<string, unknown>[]) => [log, ...prev]);
      setNotifications((prev: Record<string, unknown>[]) => [notification, ...prev]);
    },
    (newFlags, updatedFlags) => {
      appState.setComplianceFlags((prev: Record<string, unknown>[]) => {
        let next: Record<string, unknown>[] = [...prev];
        updatedFlags.forEach(uf => {
          next = next.map(f => f.id === (uf as unknown as Record<string, unknown>).id ? (uf as unknown as Record<string, unknown>) : f);
        });
        return [...newFlags as unknown as Record<string, unknown>[], ...next];
      });
    }
  );

  // Stable handlers for NotificationsDrawer (avoids breaking React.memo)
  const handleCloseDrawer = useCallback(() => {
    setIsNotificationsDrawerOpen(false);
  }, [setIsNotificationsDrawerOpen]);

  const handleClearBroadcast = useCallback(() => {
    setNotifications((prev: Record<string, unknown>[]) => prev.map((n: Record<string, unknown>) => ({ ...n, read: true })));
  }, [setNotifications]);

  // Derived data for NotificationsDrawer (also computed inside AppHeader for the badge)
  const unreadNotificationsCount = useMemo(
    () => (notifications || []).filter((n: Record<string, unknown>) => !n.read).length,
    [notifications]
  );
  const pendingApprovals = useMemo(
    () => (documents || []).filter((d: Record<string, unknown>) => {
      if (!d) return false;
      if (d.status !== "Pending Contractor Approval" && d.status !== "Pending Central Approval") return false;
      if (user && !user.isCentral && user.contractorId) return d.contractorId === user.contractorId;
      return true;
    }),
    [documents, user]
  );

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
    <div className={`flex lg:flex-row flex-col min-h-0 h-screen h-[100dvh] w-full font-sans overflow-hidden ${isDarkMode ? "dark bg-slate-950" : "bg-[#F8F9FA]"}`}>
      
      <Sidebar 
        user={user}
        activeTab={activeTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isDarkMode={isDarkMode}
        setIsDarkMode={appState.setIsDarkMode}
        contractors={appState.contractors}
        handleLogout={handleLogout}
      />

      <NotificationsDrawer 
        show={isNotificationsDrawerOpen}
        onClose={handleCloseDrawer}
        notifications={notifications}
        pendingApprovals={pendingApprovals}
        unreadCount={unreadNotificationsCount}
        handleClearBroadcast={handleClearBroadcast}
        setViewingDoc={appState.setViewingDoc}
      />

      <MobileNav 
        user={user}
        activeTab={activeTab}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden lg:pb-0">

        <AppHeader
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          setIsNotificationsDrawerOpen={setIsNotificationsDrawerOpen}
          notifications={notifications}
          documents={documents}
          user={user}
          onRefresh={() => {}}
        />

        <div className="flex-1 flex flex-col min-h-0 custom-scrollbar mobile-scrolling touch-scroll">
          {children}
        </div>
      </main>

      {appState.showUploadDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[200] flex items-start md:items-center justify-center p-4 overflow-y-auto modal-mobile-bottom">
          <div className="my-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <UploadDocumentForm 
              onClose={() => appState.setShowUploadDoc(false)}
              newDoc={appState.newDoc}
              setNewDoc={appState.setNewDoc}
              handleSubmitDocument={handleSubmitDocument}
              actionLoading={appState.actionLoading}
              uploadedFileBase64={appState.uploadedFileBase64}
              setUploadedFileBase64={appState.setUploadedFileBase64}
              uploadedFileMimeType={appState.uploadedFileMimeType}
              setUploadedFileMimeType={appState.setUploadedFileMimeType}
              dragActive={appState.dragActive}
              setDragActive={appState.setDragActive}
              user={user}
              technicians={appState.technicians}
              allDocumentTypes={appState.allDocumentTypes}
              allRoles={appState.allRoles}
              onUploadComplete={(newDocData) => {
                // Immediately reflect the newly uploaded document in the
                // global documents list so modals (e.g. TechnicianDetails)
                // show it without requiring a full page refresh.
                appState.setDocuments((prev: Record<string, unknown>[]) => [newDocData, ...prev]);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}


