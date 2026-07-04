"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, FolderOpen, ShieldCheck, Menu, Users, BarChart3, Building2 } from "lucide-react";
import { User, Role } from "../types";

interface MobileNavProps {
  user: User | null;
  activeTab: string;
  setIsSidebarOpen: (open: boolean) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  user,
  activeTab,
  setIsSidebarOpen
}) => {
  const router = useRouter();

  const tabs = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  ];

  if (user?.role !== Role.Technician) {
    tabs.push({ id: "projects", label: "Projects", icon: FolderOpen });
    tabs.push({ id: "ehs", label: "EHS", icon: ShieldCheck });
    tabs.push({ id: "technicians", label: "Crew", icon: Users });
    if (user?.isCentral) {
      tabs.push({ id: "reports", label: "Reports", icon: BarChart3 });
    }
    if (user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomEHSOfficer) {
      tabs.push({ id: "contractors", label: "Partners", icon: Building2 });
    }
  } else {
    tabs.push({ id: "projects", label: "My Work", icon: FolderOpen });
    tabs.push({ id: "technicians", label: "Profile", icon: Users });
  }

  const navigateTo = (tabId: string) => {
    if (tabId === "dashboard") {
      router.push("/");
    } else {
      router.push(`/${tabId}`);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-[80] flex items-center justify-around h-[72px] safe-bottom px-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] lg:hidden tap-highlight-transparent">
      {tabs.slice(0, 4).map((tab) => (
        <button 
          key={tab.id}
          onClick={() => navigateTo(tab.id)}
          className={`flex flex-col items-center justify-center gap-0.5 transition-all relative min-w-[48px] min-h-[44px] rounded-xl px-2 active:scale-90 tap-highlight-transparent touch-manipulation ${
            activeTab === tab.id ? 'text-[#E61C24]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <tab.icon className={`w-[22px] h-[22px] ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`} />
          <span className="text-[8px] font-black uppercase tracking-[0.12em]">{tab.label}</span>
          {activeTab === tab.id && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#E61C24] rounded-full" />
          )}
        </button>
      ))}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 text-slate-400 active:scale-90 transition-transform min-w-[48px] min-h-[44px] rounded-xl px-2 tap-highlight-transparent"
      >
        <Menu className="w-[22px] h-[22px]" />
        <span className="text-[8px] font-black uppercase tracking-[0.12em]">More</span>
      </button>
    </nav>
  );
};
