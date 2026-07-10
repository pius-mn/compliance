"use client";

import React, { memo } from "react";
import { Menu, Bell, Building2, RefreshCw } from "lucide-react";
import type { User } from "../types";

interface AppHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  setIsNotificationsDrawerOpen: (open: boolean) => void;
  notifications: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  user: User | null;
  onRefresh: () => void;
}

function AppHeader({
  isSidebarOpen,
  setIsSidebarOpen,
  setIsNotificationsDrawerOpen,
  notifications,
  documents,
  user,
  onRefresh,
}: AppHeaderProps) {
  const unreadNotificationsCount = (notifications || []).filter(
    (n: Record<string, unknown>) => !n.read
  ).length;

  const pendingApprovals = (documents || []).filter(
    (d: Record<string, unknown>) => {
      if (!d) return false;
      if (
        d.status !== "Pending Contractor Approval" &&
        d.status !== "Pending Central Approval"
      )
        return false;
      if (user && !user.isCentral && user.contractorId)
        return d.contractorId === user.contractorId;
      return true;
    }
  );
  const pendingApprovalsCount = pendingApprovals.length;

  return (
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
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">
              Safaricom & Partners
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center space-x-2 text-[10px] font-black uppercase text-slate-400 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live System</span>
        </div>

        <button
          onClick={onRefresh}
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
  );
}

export default memo(AppHeader);
