"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Notification, TechnicianDocument, Contractor } from "../types";
import { Drawer } from "./Drawer";

interface NotificationsDrawerProps {
  show: boolean;
  onClose: () => void;
  notifications: Notification[];
  pendingApprovals: TechnicianDocument[];
  unreadCount: number;
  handleClearBroadcast: () => void;
  setViewingDoc: (doc: TechnicianDocument) => void;
  contractors: Contractor[];
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  show,
  onClose,
  notifications,
  pendingApprovals,
  unreadCount,
  handleClearBroadcast,
  setViewingDoc,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contractors
}) => {
  const router = useRouter();

  return (
    <Drawer
      show={show}
      onClose={onClose}
      title="Alerts & Approvals"
      subtitle="Real-time Safety Updates"
      width="max-w-md"
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {/* Approvals Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Pending EHS Signoffs</span>
            <span className="text-[9px] font-black text-white bg-slate-900 px-2 py-0.5 rounded-full">{pendingApprovals.length} Action Items</span>
          </div>
          
          {pendingApprovals && pendingApprovals.length === 0 ? (
            <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-50" />
              <p className="font-black text-slate-900 uppercase text-[11px] tracking-widest">All Systems Nominal</p>
              <p className="text-[10px] text-slate-400 font-bold">No pending compliance documents require attention.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(pendingApprovals || []).map(d => (
                <div 
                  key={d.id} 
                  className="bg-white border-2 border-slate-50 hover:border-[#E61C24]/20 rounded-[20px] p-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-black text-slate-900 text-sm leading-tight uppercase italic">{d.fileName}</span>
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0 ${
                        d.status === "Pending Contractor Approval" ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                      }`}>
                        {d.status === "Pending Contractor Approval" ? "Contractor" : "Central"}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        Technician: <span className="text-slate-900">{d.technicianName}</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        Uploaded: {d.uploadDate}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setViewingDoc(d);
                        router.push("/ehs");
                        onClose();
                      }}
                      className="w-full py-2 bg-slate-50 group-hover:bg-[#E61C24] text-slate-400 group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Initialize Audit Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcasts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Safety Broadcasts</span>
            {unreadCount > 0 && (
              <button onClick={handleClearBroadcast} className="text-[9px] font-black text-[#E61C24] hover:underline uppercase tracking-widest">Mark All Read</button>
            )}
          </div>
          
          {notifications && notifications.length === 0 ? (
            <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] text-center">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No active logs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(notifications || []).map(n => (
                <div 
                  key={n.id} 
                  className="bg-[#F8F9FA] border-2 border-transparent hover:border-slate-200 rounded-[20px] p-4 relative overflow-hidden group"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    n.type === "success" ? "bg-emerald-500" :
                    n.type === "warning" ? "bg-amber-500" :
                    n.type === "danger" ? "bg-red-500" : "bg-blue-500"
                  }`} />

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-slate-900 text-[11px] uppercase tracking-tight">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[#E61C24] animate-pulse shadow-lg shadow-red-200" />}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{n.message}</p>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block pt-1">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
