"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  Bell, 
  Building2, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle
} from "lucide-react";

// Views
import Login from "../views/Login";

// Components
import { Sidebar } from "../components/Sidebar";
import { NotificationsDrawer } from "../components/NotificationsDrawer";
import { MobileNav } from "../components/MobileNav";
import { UploadDocumentForm } from "../components/UploadDocumentModal";
import { useApp } from "../context/AppContext";
import { useSSE } from "../hooks/useSSE";
import LoadingFallback from "../components/LoadingFallback";

const AlertCheckIcon = ({ type }: { type: string }) => {
  if (type === 'error') return <AlertTriangle className="w-4 h-4" />;
  return <CheckCircle className="w-4 h-4" />;
};

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
    sysAlert,
    setSysAlert,
    refetchData,
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

  // Manual refresh handler — re-fetches all data collections
  const handleManualRefresh = () => {
    refetchData([
      "projects", "technicians", "documents", "auditLogs", "notifications",
      "contractors", "users", "workRoles", "documentTypes", "milestones",
      "complianceFlags", "sitePhotos", "predefinedMilestones", "predefinedPrerequisites",
    ]);
  };

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Login onLogin={handleLogin} />
      </Suspense>
    );
  }

  const unreadNotificationsCount = (notifications || []).filter((n: Record<string, unknown>) => !n.read).length;
  const pendingApprovals = (documents || []).filter((d: Record<string, unknown>) => {
    if (!d) return false;
    if (d.status !== "Pending Contractor Approval" && d.status !== "Pending Central Approval") return false;
    if (user && !user.isCentral && user.contractorId) return d.contractorId === user.contractorId;
    if (d.complianceResult && (d.complianceResult as Record<string, unknown>).verifiedByAi === false) return false;
    return true;
  });
  const pendingApprovalsCount = pendingApprovals.length;

  return (
    <div className={`flex lg:flex-row flex-col min-h-0 h-screen h-[100dvh] w-full font-sans overflow-hidden ${isDarkMode ? "dark bg-slate-950" : "bg-[#F8F9FA]"}`}>
      
      <Sidebar 
        user={user}
        activeTab={activeTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isDarkMode={isDarkMode}
        setIsDarkMode={appState.setIsDarkMode}
        contractors={appState.contractors || []}
        handleLogout={handleLogout}
      />

      <NotificationsDrawer 
        show={isNotificationsDrawerOpen}
        onClose={() => setIsNotificationsDrawerOpen(false)}
        notifications={notifications}
        pendingApprovals={pendingApprovals}
        unreadCount={unreadNotificationsCount}
        handleClearBroadcast={() => setNotifications((prev: Record<string, unknown>[]) => prev.map((n: Record<string, unknown>) => ({ ...n, read: true })))}
        setViewingDoc={appState.setViewingDoc}
        contractors={appState.contractors || []}
      />

      <MobileNav 
        user={user}
        activeTab={activeTab}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-20 lg:pb-0">
        
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 bg-red-50 text-[#E61C24] rounded-lg hidden sm:block">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-none uppercase italic">
                  EHS <span className="text-[#E61C24] font-black">Portal</span>
                </h1>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Safaricom & Partners</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center space-x-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live System</span>
            </div>

            <button 
              onClick={handleManualRefresh}
              className="min-touch flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-100 active:scale-95 tap-highlight-transparent"
              title="Refresh All Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsNotificationsDrawerOpen(true)}
              className="min-touch flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all border border-slate-100 relative active:scale-95 tap-highlight-transparent"
            >
              <Bell className="w-4.5 h-4.5" />
              {(unreadNotificationsCount > 0 || pendingApprovalsCount > 0) && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E61C24] text-[10px] font-black text-white border-2 border-white shadow-lg">
                  {unreadNotificationsCount + pendingApprovalsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {sysAlert && (
          <div className="px-4 sm:px-8 pt-4">
            <div className={`p-4 rounded-[20px] border-2 flex items-center justify-between animate-in slide-in-from-top-4 duration-500 ${sysAlert.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <div className="flex items-center gap-3">
                <AlertCheckIcon type={sysAlert.type} />
                <p className="text-xs font-black uppercase tracking-widest">{sysAlert.message}</p>
              </div>
              <button onClick={() => setSysAlert(null)} className="p-1 hover:opacity-50">×</button>
            </div>
          </div>
        )}

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
            />
          </div>
        </div>
      )}

    </div>
  );
}


