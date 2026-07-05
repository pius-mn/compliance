"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Notification, TechnicianDocument, Contractor } from "../types";
import { Drawer } from "./Drawer";
import { getDocStatus } from "../utils/helpers";

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

// ---- shared bits, pulled out so the two sections below don't repeat markup/logic ----

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
      <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 dark:text-white">
        {label}
      </span>
      {right}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="p-8 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[24px] text-center space-y-2">
      {icon}
      <p className="font-black text-slate-900 dark:text-slate-100 uppercase text-[11px] tracking-widest">{title}</p>
      {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{subtitle}</p>}
    </div>
  );
}

const APPROVAL_STATUS_STYLES: Record<string, string> = {
  "Pending Contractor Approval":
    "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
};
const APPROVAL_STATUS_DEFAULT =
  "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";

function ApprovalCard({
  doc,
  onReview,
}: {
  doc: TechnicianDocument;
  onReview: (doc: TechnicianDocument) => void;
}) {
  const isContractor = getDocStatus(doc) === "Pending Contractor Approval";
  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 hover:border-[#E61C24]/20 rounded-[20px] p-4 shadow-sm hover:shadow-md dark:shadow-none transition-all group">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <span className="font-black text-slate-900 dark:text-slate-100 text-sm leading-tight uppercase italic">
            {doc.fileName}
          </span>
          <span
            className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shrink-0 border ${
              isContractor ? APPROVAL_STATUS_STYLES["Pending Contractor Approval"] : APPROVAL_STATUS_DEFAULT
            }`}
          >
            {isContractor ? "Contractor" : "Central"}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            Technician: <span className="text-slate-900 dark:text-slate-100">{doc.technicianName}</span>
          </div>
          <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            Uploaded: {doc.uploadDate}
          </div>
        </div>

        <button
          onClick={() => onReview(doc)}
          className="w-full py-2 bg-slate-50 dark:bg-slate-800 group-hover:bg-[#E61C24] text-slate-400 dark:text-slate-500 group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          Initialize Audit Review
        </button>
      </div>
    </div>
  );
}

const NOTIFICATION_ACCENT: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};
const NOTIFICATION_ACCENT_DEFAULT = "bg-blue-500";

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="bg-[#F8F9FA] dark:bg-slate-900 border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-800 rounded-[20px] p-4 relative overflow-hidden group">
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          NOTIFICATION_ACCENT[notification.type] || NOTIFICATION_ACCENT_DEFAULT
        }`}
      />
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="font-black text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-tight">
            {notification.title}
          </span>
          {!notification.read && (
            <span className="w-2 h-2 rounded-full bg-[#E61C24] animate-pulse shadow-lg shadow-red-200 dark:shadow-red-900/40" />
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          {notification.message}
        </p>
        <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest block pt-1">
          {new Date(notification.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  show,
  onClose,
  notifications,
  pendingApprovals,
  unreadCount,
  handleClearBroadcast,
  setViewingDoc,
}) => {
  const router = useRouter();

  const handleReview = (doc: TechnicianDocument) => {
    setViewingDoc(doc);
    router.push("/ehs");
    onClose();
  };

  return (
    <Drawer show={show} onClose={onClose} title="Alerts & Approvals" subtitle="Real-time Safety Updates" width="max-w-md">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar dark:bg-slate-950">
        {/* Approvals Section */}
        <div className="space-y-4">
          <SectionHeader
            label="Pending EHS Signoffs"
            right={
              <span className="text-[9px] font-black text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 px-2 py-0.5 rounded-full">
                {pendingApprovals.length} Action Items
              </span>
            }
          />

          {!pendingApprovals || pendingApprovals.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-50" />}
              title="All Systems Nominal"
              subtitle="No pending compliance documents require attention."
            />
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((d) => (
                <ApprovalCard key={d.id} doc={d} onReview={handleReview} />
              ))}
            </div>
          )}
        </div>

        {/* Broadcasts Section */}
        <div className="space-y-4">
          <SectionHeader
            label="Safety Broadcasts"
            right={
              unreadCount > 0 && (
                <button
                  onClick={handleClearBroadcast}
                  className="text-[9px] font-black text-[#E61C24] hover:underline uppercase tracking-widest"
                >
                  Mark All Read
                </button>
              )
            }
          />

          {!notifications || notifications.length === 0 ? (
            <EmptyState title="No active logs" />
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
