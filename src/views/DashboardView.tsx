"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, ChevronDown } from "lucide-react";
import { TechnicianDocument, Notification, User, Contractor } from "../types";
import { safeString } from "../utils/helpers";
import { isSafaricomRole, isTechnician as isTechnicianRole } from "../lib/roles";

// Dashboard stats shape returned by the server
export interface DashboardStatsResponse {
  user: { id: string; name: string; role: string; isSafaricom: boolean; isContractor: boolean; contractorId: string | null };
  contractorFilter: string | null;
  contractorName: string | null;
  projectStats: { total: number; completed: number; inProgress: number; planning: number; onHold: number; totalBudget: number };
  documentStats: { total: number; approved: number; pendingContractor: number; pendingCentral: number; rejected: number };
  technicianStats: { total: number; active: number; warningNeeded: number; avgScore: number };
  milestoneStats: { total: number; completed: number; inProgress: number; pending: number; blocked: number; completionRate: number };
  complianceStats: { total: number; active: number; resolved: number; highSeverity: number; mediumSeverity: number; lowSeverity: number };
  complianceTrend: Array<{ month: string; created: number; resolved: number }>;
  milestoneCompletedTrend: Array<{ month: string; created: number; resolved: number }>;
}
import {
  ResponsiveContainer,
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

const CompTrendTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: { month: string } }[] }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-2.5 rounded-lg shadow-lg text-[10px] font-sans">
        <p className="font-semibold text-slate-400 mb-1">{payload[0].payload.month}</p>
        {payload.map((entry: { name: string; value: number; color: string }, idx: number) => (
          <p key={idx} className="text-white mt-0.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}: <span className="font-extrabold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MilestoneTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { month: string } }[] }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-2.5 rounded-lg shadow-lg text-[10px] font-sans">
        <p className="font-semibold text-slate-400 mb-1">{payload[0].payload.month}</p>
        <p className="text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Completed: <span className="font-extrabold">{(payload[0] as { value: number }).value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export interface DashboardViewProps {
  user: User | null;
  dashboardStats: DashboardStatsResponse | null;
  pendingDocuments: TechnicianDocument[];
  notifications: Notification[];
  handleClearBroadcast: () => void;
  setViewingDoc: (doc: TechnicianDocument) => void;
  contractors: Contractor[];
  selectedContractorId?: string | null;
  onContractorChange?: (contractorId: string | null) => void;
}

// ---- shared pieces, pulled out so the 8 KPI cards / 2 feed panels don't repeat markup ----

function formatTime(value: unknown) {
  try {
    return new Date(value as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    try {
      return safeString(value);
    } catch {
      return "Unknown";
    }
  }
}

const BADGE_TONES = {
  emerald: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
  red: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  amber: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  blue: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  slate: "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800",
} as const;

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return <span className={`font-bold px-2 py-0.5 rounded-full truncate ${BADGE_TONES[tone]}`}>{children}</span>;
}

function KpiCard({
  id,
  label,
  footer,
  children,
}: {
  id?: string;
  label: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="bg-white dark:bg-slate-900 p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0"
    >
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">
          {label}
        </p>
        {children}
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">{footer}</div>
    </div>
  );
}

function NotificationItem({ notification, compact }: { notification: Notification; compact?: boolean }) {
  return (
    <div
      className={`text-xs rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 ${
        compact ? "space-y-1 p-2.5" : "space-y-1.5 p-3 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{safeString(notification.title)}</span>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{formatTime(notification.createdAt)}</span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{safeString(notification.message)}</p>
    </div>
  );
}

function NotificationFeedCard({
  notifications,
  onClearBroadcast,
  variant,
}: {
  notifications: Notification[];
  onClearBroadcast: () => void;
  variant: "full" | "compact";
}) {
  const isFull = variant === "full";
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 ${isFull ? "p-6" : "p-4"}`}>
      <div className={`flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${isFull ? "pb-3" : "pb-2"}`}>
        <h3
          className={`font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider ${isFull ? "text-sm" : "text-xs"}`}
        >
          {isFull && <span className="w-2 h-2 rounded-full bg-[#E61C24] inline-block mr-2 animate-pulse" />}
          Audit Alert Log Feed
        </h3>
        <button
          onClick={onClearBroadcast}
          className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-[#E61C24] dark:hover:text-red-400 font-bold"
        >
          {isFull ? "Mark All Read" : "Mark Read"}
        </button>
      </div>

      <div className={`space-y-3 overflow-y-auto pr-1 ${isFull ? "max-h-[400px]" : "max-h-[220px]"}`}>
        {notifications.length > 0 ? (
          notifications.map((n) => <NotificationItem key={n.id} notification={n} compact={!isFull} />)
        ) : isFull ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            No recent alerts. All clear.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PendingDocCard({ doc, actionLabel, onReview }: { doc: TechnicianDocument; actionLabel: string; onReview: () => void }) {
  return (
    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] bg-red-50 dark:bg-red-500/10 text-[#E61C24] dark:text-red-400 font-bold px-2 py-0.5 rounded-full tracking-wider">
          {doc.type}
        </span>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{doc.uploadDate}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-950 dark:text-white mb-0.5">{doc.fileName}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tech: {doc.technicianName}</p>
      </div>
      <div className="pt-2">
        <button
          onClick={onReview}
          className="w-full flex justify-center items-center py-2 bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-bold rounded-lg shadow-sm dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-600 transition"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" /> {actionLabel}
        </button>
      </div>
    </div>
  );
}

interface WorkflowStepData {
  number: number;
  numberBg: string;
  title: string;
  description: React.ReactNode;
}

const WORKFLOW_STEPS: WorkflowStepData[] = [
  {
    number: 1,
    numberBg: "bg-[#E61C24]",
    title: "Technician Uploads",
    description: "Technician logs their JSA, PPE audit, or Heights Permits using raw text. Run AI compliance verification with Gemini.",
  },
  {
    number: 2,
    numberBg: "bg-slate-800 dark:bg-slate-700",
    title: "Contractor Approval",
    description: (
      <>
        Contractor Safety Lead reviews the report. Approving moves status to <span className="font-semibold">Pending Central Approval</span>.
      </>
    ),
  },
  {
    number: 3,
    numberBg: "bg-emerald-600",
    title: "Central Audit",
    description: "HQ Safety Lead examines comments and officially grants full compliance validation, boosting the technician's official record safety rating.",
  },
];

function WorkflowStep({ step }: { step: WorkflowStepData }) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex items-center space-x-2">
        <span className={`w-5 h-5 rounded-full ${step.numberBg} text-white flex items-center justify-center text-xs font-bold font-mono`}>
          {step.number}
        </span>
        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{step.title}</span>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{step.description}</p>
    </div>
  );
}

const DashboardView: React.FC<DashboardViewProps> = React.memo(function DashboardView({
  user,
  dashboardStats,
  pendingDocuments = [],
  notifications = [],
  handleClearBroadcast,
  setViewingDoc,
  contractors = [],
  selectedContractorId,
  onContractorChange,
}) {
  // Defer chart rendering until container has actual dimensions
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [chartsReady, setChartsReady] = React.useState(false);
  React.useEffect(() => {
    let rafId: number;
    const check = () => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setChartsReady(true);
          return;
        }
      }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Trend data from server ────────────────────────────────────────────────
  const complianceTrend = dashboardStats?.complianceTrend ?? [];
  const milestoneCompletedTrend = dashboardStats?.milestoneCompletedTrend ?? [];
  const hasComplianceTrend = complianceTrend.length > 0 && complianceTrend.some((b) => b.created > 0 || b.resolved > 0);
  const hasMilestoneTrend = milestoneCompletedTrend.length > 0 && milestoneCompletedTrend.some((b) => b.created > 0);

  const router = useRouter();
  const navigateTo = (tab: string) => {
    router.push(tab === "dashboard" ? "/" : `/${tab}`);
  };
  const isTechnician = user ? isTechnicianRole(user.role) : false;
  const isSafaricomUser = user ? isSafaricomRole(user.role) : false;

  const reviewDoc = (doc: TechnicianDocument) => {
    setViewingDoc(doc);
    navigateTo("ehs");
  };

  // Compute KPI values from server-side stats (lightweight, no full collection fetching)
  const projectCount = dashboardStats?.projectStats.total ?? 0;
  const techCount = dashboardStats?.technicianStats.total ?? 0;
  const avgScore = dashboardStats?.technicianStats.avgScore ?? 100;
  const pendingCount =
    (dashboardStats?.documentStats.pendingContractor ?? 0) +
    (dashboardStats?.documentStats.pendingCentral ?? 0);
  const totalDocCount = dashboardStats?.documentStats.total ?? 0;

  // ── Milestone & Compliance stats ──────────────────────────────────────────
  const ms = dashboardStats?.milestoneStats;
  const cs = dashboardStats?.complianceStats;
  const milestoneCompletionRate = ms?.completionRate ?? 0;
  const milestoneTotal = ms?.total ?? 0;
  const milestoneBlocked = ms?.blocked ?? 0;
  const milestoneInProgress = ms?.inProgress ?? 0;
  const complianceActive = cs?.active ?? 0;
  const complianceHigh = cs?.highSeverity ?? 0;
  const complianceMedium = cs?.mediumSeverity ?? 0;
  const complianceLow = cs?.lowSeverity ?? 0;

  // ── Budget ────────────────────────────────────────────────────────────────
  const totalBudget = dashboardStats?.projectStats.totalBudget ?? 0;
  const formatBudget = (amount: number) => {
    if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(1)}K`;
    return `KES ${amount}`;
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-4 md:space-y-6 max-w-[1600px] w-full mx-auto">

      {/* Contractor Filter Dropdown — Safaricom users only */}
      {isSafaricomUser && (
        <div className="flex items-center justify-end">
          <div className="relative inline-flex items-center gap-2">
            <label htmlFor="contractor-filter" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Filter by contractor
            </label>
            <select
              id="contractor-filter"
              name="contractorFilter"
              value={selectedContractorId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                onContractorChange?.(val === "" ? null : val);
              }}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <option value="">All Contractors</option>
              {contractors
                .filter((c) => c.status === "Active")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Highlight Dashboard Overview - Optimized Grid for Mobile Visibility */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KpiCard id="stat_projects" label={isTechnician ? "My Assignments" : "Projects"} footer={<Badge tone="emerald">Site Work</Badge>}>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950 dark:text-white">{projectCount}</h2>
          {!isTechnician && totalBudget > 0 && (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">{formatBudget(totalBudget)}</p>
          )}
        </KpiCard>

        <KpiCard id="stat_compliance" label={isTechnician ? "My Safety Score" : "Compliance"} footer={<Badge tone="red">Target 90%</Badge>}>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950 dark:text-white">{avgScore}%</h2>
        </KpiCard>

        <KpiCard
          id="stat_approvals"
          label={isTechnician ? "My Pending Certs" : "Pending Approvals"}
          footer={
            <span className="text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
              {isTechnician ? "Verification Flow" : "Action Needed"}
            </span>
          }
        >
          <h2 className="text-2xl md:text-4xl font-extrabold text-[#E61C24]">{pendingCount}</h2>
        </KpiCard>

        {!isTechnician && (
          <KpiCard id="stat_technicians" label="Riggers" footer={<Badge tone="emerald">Active certs</Badge>}>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950 dark:text-white">{techCount}</h2>
          </KpiCard>
        )}

        {isTechnician && (
          <KpiCard id="stat_my_docs" label="Total Documents" footer={<Badge tone="emerald">Safety Record</Badge>}>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950 dark:text-white">{totalDocCount}</h2>
          </KpiCard>
        )}
      </div>

      {/* Milestone & Compliance KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KpiCard label="Milestone Completion" footer={<Badge tone="amber">{milestoneTotal} total</Badge>}>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950 dark:text-white">{milestoneCompletionRate}%</h2>
        </KpiCard>

        <KpiCard
          label="In Progress"
          footer={<Badge tone="blue">{milestoneBlocked > 0 ? `${milestoneBlocked} blocked` : "All on track"}</Badge>}
        >
          <h2 className="text-2xl md:text-4xl font-extrabold text-blue-700 dark:text-blue-400">{milestoneInProgress}</h2>
        </KpiCard>

        <KpiCard
          label="Active Flags"
          footer={<span className="text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Requires Action</span>}
        >
          <h2 className="text-2xl md:text-4xl font-extrabold text-[#E61C24]">{complianceActive}</h2>
        </KpiCard>

        <KpiCard label="High / Med / Low" footer={<Badge tone="slate">Severity Scale</Badge>}>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg md:text-2xl font-extrabold text-red-600 dark:text-red-400">{complianceHigh}</span>
            <span className="text-slate-300 dark:text-slate-600 text-lg">/</span>
            <span className="text-lg md:text-2xl font-extrabold text-amber-500 dark:text-amber-400">{complianceMedium}</span>
            <span className="text-slate-300 dark:text-slate-600 text-lg">/</span>
            <span className="text-lg md:text-2xl font-extrabold text-emerald-500 dark:text-emerald-400">{complianceLow}</span>
          </div>
        </KpiCard>
      </div>

      {/* EHS Statistics Overview Summary Section */}
      <div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 dark:text-white mb-4 md:mb-6 text-xs md:text-sm uppercase tracking-widest">
              {isTechnician ? "My Performance" : "EHS Stats Overview"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-4 md:gap-6">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  {isTechnician ? "Active Assignments" : "Total Projects"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-slate-950 dark:text-white mt-1">{projectCount}</h2>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  {isTechnician ? "Personal Score" : "Avg Compliance"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-slate-950 dark:text-white mt-1">{avgScore}%</h2>
              </div>
              <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                <p className="text-slate-500 dark:text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  {isTechnician ? "Pending Verification" : "Pending Audits"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-[#E61C24] mt-1">{pendingCount}</h2>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-950 dark:text-white text-sm uppercase tracking-widest">
              {isTechnician ? "Compliance History" : "6-Month Compliance Flags Trend"}
            </h4>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {avgScore >= 85 ? "Strong" : "Needs Improvement"}
            </span>
          </div>

          {/* Compliance flags trend chart */}
          <div ref={chartRef} className="w-full h-[170px] bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-100 dark:border-slate-800 shadow-inner dark:shadow-none">
            {chartsReady && hasComplianceTrend ? (
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <BarChart data={complianceTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 9, fontWeight: 550 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 9, fontWeight: 550 }} />
                  <Tooltip content={<CompTrendTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingTop: 4 }} />
                  <Bar dataKey="created" name="New Flags" fill="#E61C24" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                {hasComplianceTrend ? "Loading chart..." : "No compliance flag data yet"}
              </div>
            )}
          </div>

          {/* Milestone completion mini-chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-extrabold text-slate-950 dark:text-white text-[10px] uppercase tracking-widest">
                Milestone Completions (6-Month)
              </h4>
            </div>
            <div className="w-full h-[90px] bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-100 dark:border-slate-800 shadow-inner dark:shadow-none">
              {chartsReady && hasMilestoneTrend ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <LineChart data={milestoneCompletedTrend} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 8, fontWeight: 550 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 8, fontWeight: 550 }} />
                    <Tooltip content={<MilestoneTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="created"
                      name="Completed"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ fill: "#10B981", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                  {hasMilestoneTrend ? "Loading chart..." : "No completed milestones yet"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split — Notifications & Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Centered notifications feed takes full left + middle columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dual-Level compliance audit visual guide */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">National EHS Dual-Signoff Workflow Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {WORKFLOW_STEPS.map((step) => (
                <WorkflowStep key={step.number} step={step} />
              ))}
            </div>
          </div>

          <NotificationFeedCard notifications={safeNotifications} onClearBroadcast={handleClearBroadcast} variant="full" />
        </div>

        {/* Rigging compliance alerts feed right panel */}
        <div className="space-y-6">
          {/* Pending documents card sidebar list */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm dark:shadow-none">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-950 dark:text-white uppercase tracking-widest text-sm">
                {isTechnician ? "Cert Verification" : "Audit Queue"}
              </h3>
              <button onClick={() => navigateTo("ehs")} className="text-[10px] font-bold text-[#E61C24] hover:underline">
                View Grid
              </button>
            </div>
            <div className="p-6 space-y-4">
              {pendingDocuments.slice(0, 3).map((d) => (
                <PendingDocCard
                  key={d.id}
                  doc={d}
                  actionLabel={isTechnician ? "Check Status" : "Open Audit"}
                  onReview={() => reviewDoc(d)}
                />
              ))}

              {pendingDocuments.length === 0 && (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  {isTechnician ? "All your certs are verified. Great!" : "Zero pending safety checks. Excellent!"}
                </div>
              )}
            </div>
          </div>

          <NotificationFeedCard notifications={safeNotifications} onClearBroadcast={handleClearBroadcast} variant="compact" />
        </div>
      </div>
    </div>
  );
});

export default DashboardView;
