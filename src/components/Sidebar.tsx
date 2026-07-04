"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  LayoutDashboard,
  FolderOpen,
  ShieldCheck,
  Users,
  BarChart3,
  Building2,
  Settings,
  Sun,
  Moon,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { Role, User, Contractor } from "../types";
import { getFriendlyRoleLabel, getActiveContractorLabel } from "../utils/helpers";

interface SidebarProps {
  user: User | null;
  activeTab: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  contractors: Contractor[];
  handleLogout: () => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

// ---- builds the nav list from role/flags instead of a long chain of if/push statements ----
function buildNavItems(user: User | null): NavItemConfig[] {
  const isTech = user?.role === Role.Technician;
  const isAdminLike = user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomEHSOfficer;

  return [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "projects", label: isTech ? "My Projects" : "Projects & Milestones", icon: FolderOpen },
    { id: "ehs", label: isTech ? "My EHS Documents" : "EHS Compliance Certs", icon: ShieldCheck },
    { id: "technicians", label: isTech ? "My Safety Profile" : "Technicians Crew", icon: Users },
    ...(!isTech ? [{ id: "reports", label: "EHS & Audit Reports", icon: BarChart3 }] : []),
    ...(user?.isCentral ? [{ id: "contractors", label: "Contractor Partners", icon: Building2 }] : []),
    ...(isAdminLike
      ? [
          { id: "safaricom-users", label: "Safaricom Employees", icon: Users },
          { id: "management", label: "User & Asset Admin", icon: Settings },
        ]
      : []),
  ];
}

function NavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItemConfig;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-6 py-3 text-left transition-all group ${
        isActive
          ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border-l-4 border-[#18863A] font-medium"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
      }`}
    >
      <item.icon
        className={`w-4 h-4 mr-3 opacity-70 group-hover:opacity-100 transition-opacity ${isActive ? "opacity-100" : ""}`}
      />
      <span className="text-sm">{item.label}</span>
    </button>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  isSidebarOpen,
  setIsSidebarOpen,
  isDarkMode,
  setIsDarkMode,
  contractors,
  handleLogout,
}) => {
  const router = useRouter();
  const navItems = buildNavItems(user);

  const navigateTo = (tabId: string) => {
    router.push(tabId === "dashboard" ? "/" : `/${tabId}`);
    setIsSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[110] lg:z-[70] bg-white dark:bg-[#1A1C1E] text-slate-900 dark:text-white flex flex-col border-slate-200 dark:border-slate-800 shrink-0 transform transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? "translate-x-0 w-64 border-r lg:static lg:translate-x-0 lg:w-64 lg:opacity-100 lg:pointer-events-auto"
            : "-translate-x-full w-64 border-r lg:static lg:-translate-x-full lg:w-0 lg:opacity-0 lg:border-r-0 lg:overflow-hidden lg:pointer-events-none"
        }`}
      >
        <div className="p-6 flex items-center gap-3 bg-[#18863A] transition-colors relative">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-[#18863A] text-xl shadow-xs">
            S
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg block leading-none uppercase text-white">
              SAFARICOM EHS
            </span>
            <span className="text-[9px] font-mono opacity-85 uppercase tracking-widest mt-1 block text-white">
              Unified Compliance
            </span>
          </div>
          <button
            className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg transition text-white/85"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-6 mb-4 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">
            Menu Navigation
          </div>

          {navItems.map((item) => (
            <NavItem key={item.id} item={item} isActive={activeTab === item.id} onClick={() => navigateTo(item.id)} />
          ))}

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/50">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center px-6 py-3 text-left transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {isDarkMode ? <Sun className="w-4 h-4 mr-3 opacity-70" /> : <Moon className="w-4 h-4 mr-3 opacity-70" />}
              <span className="text-sm">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 pb-32 lg:pb-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A1C1E] mt-auto">
          <div className="bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/30 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-white text-[11px] truncate uppercase tracking-tight">
                {user?.name}
              </span>
              <span className="text-[9px] text-[#E61C24] font-black uppercase tracking-wider mt-0.5">
                {getFriendlyRoleLabel(user?.role)}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-500 font-bold truncate mt-1">
                {getActiveContractorLabel(user?.contractorId || null, contractors, true)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest border border-red-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
