"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, ChevronDown } from "lucide-react";
import { TechnicianDocument, Notification, User, Contractor } from "../types";
import { safeString } from "../utils/helpers";
import type { DashboardStatsResponse } from "../utils/dataSync";
import { isSafaricomRole, isTechnician as isTechnicianRole } from "../lib/roles";
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

const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  dashboardStats,
  pendingDocuments = [],
  notifications = [],
  handleClearBroadcast,
  setViewingDoc,
  contractors = [],
  selectedContractorId,
  onContractorChange,
}) => {
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
    if (tab === "dashboard") {
      router.push("/");
    } else {
      router.push(`/${tab}`);
    }
  };
  const isTechnician = user ? isTechnicianRole(user.role) : false;
  const isSafaricomUser = user ? isSafaricomRole(user.role) : false;

  // Compute KPI values from server-side stats (lightweight, no full collection fetching)
  const projectCount = dashboardStats?.projectStats.total ?? 0;
  const techCount = dashboardStats?.technicianStats.total ?? 0;
  const avgScore = dashboardStats?.technicianStats.avgScore ?? 100;
  const pendingCount =
    (dashboardStats?.documentStats.pendingBranch ?? 0) +
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 md:space-y-6 max-w-[1600px] w-full mx-auto">
      
      {/* Contractor Filter Dropdown — Safaricom users only */}
      {isSafaricomUser && (
        <div className="flex items-center justify-end">
          <div className="relative inline-flex items-center gap-2">
            <label htmlFor="contractor-filter" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filter by contractor</label>
            <select
              id="contractor-filter"
              name="contractorFilter"
              value={selectedContractorId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                onContractorChange?.(val === "" ? null : val);
              }}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 cursor-pointer hover:border-slate-300 transition-colors"
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
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Highlight Dashboard Overview - Optimized Grid for Mobile Visibility */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        
        <div id="stat_projects" className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">
              {isTechnician ? "My Assignments" : "Projects"}
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950">{projectCount}</h2>
            {!isTechnician && totalBudget > 0 && (
              <p className="text-[10px] text-emerald-700 font-bold mt-1">{formatBudget(totalBudget)}</p>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full truncate">Site Work</span>
          </div>
        </div>

        {/* EHS Safety KPI Card */}
        <div id="stat_compliance" className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">
              {isTechnician ? "My Safety Score" : "Compliance"}
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950">{avgScore}%</h2>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-full">Target 90%</span>
          </div>
        </div>

        {/* Approvals KPI Card */}
        <div id="stat_approvals" className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">
              {isTechnician ? "My Pending Certs" : "Pending Approvals"}
            </p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#E61C24]">{pendingCount}</h2>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-red-600 font-bold uppercase tracking-wider">{isTechnician ? "Verification Flow" : "Action Needed"}</span>
          </div>
        </div>
        
        {/* Field Technicians Card */}
        {!isTechnician && (
          <div id="stat_technicians" className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div>
              <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">Riggers</p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950">{techCount}</h2>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Active certs</span>
            </div>
          </div>
        )}

        {isTechnician && (
          <div id="stat_my_docs" className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
            <div>
              <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">Total Documents</p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950">{totalDocCount}</h2>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Safety Record</span>
            </div>
          </div>
        )}

      </div>

      {/* Milestone & Compliance KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">

        {/* Milestone Completion Rate */}
        <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">Milestone Completion</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-slate-950">{milestoneCompletionRate}%</h2>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">{milestoneTotal} total</span>
          </div>
        </div>

        {/* Milestones In Progress */}
        <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">In Progress</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-blue-700">{milestoneInProgress}</h2>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
              {milestoneBlocked > 0 ? `${milestoneBlocked} blocked` : "All on track"}
            </span>
          </div>
        </div>

        {/* Active Compliance Flags */}
        <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">Active Flags</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-[#E61C24]">{complianceActive}</h2>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-red-600 font-bold uppercase tracking-wider">Requires Action</span>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div>
            <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-0.5 md:mb-1">High / Med / Low</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg md:text-2xl font-extrabold text-red-600">{complianceHigh}</span>
              <span className="text-slate-300 text-lg">/</span>
              <span className="text-lg md:text-2xl font-extrabold text-amber-500">{complianceMedium}</span>
              <span className="text-slate-300 text-lg">/</span>
              <span className="text-lg md:text-2xl font-extrabold text-emerald-500">{complianceLow}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] md:text-[11px]">
            <span className="text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-full">Severity Scale</span>
          </div>
        </div>

      </div>

      {/* EHS Statistics Overview Summary Section */}
      <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-950 mb-4 md:mb-6 text-xs md:text-sm uppercase tracking-widest">
              {isTechnician ? "My Performance" : "EHS Stats Overview"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-4 md:gap-6">
              <div>
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                  {isTechnician ? "Active Assignments" : "Total Projects"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-slate-950 mt-1">{projectCount}</h2>
              </div>
              <div>
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                   {isTechnician ? "Personal Score" : "Avg Compliance"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-slate-950 mt-1">
                  {avgScore}%
                </h2>
              </div>
              <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                <p className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
                   {isTechnician ? "Pending Verification" : "Pending Audits"}
                </p>
                <h2 className="text-xl md:text-3xl font-extrabold text-[#E61C24] mt-1">
                  {pendingCount}
                </h2>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-950 text-sm uppercase tracking-widest">
               {isTechnician ? "Compliance History" : "6-Month Compliance Flags Trend"}
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {avgScore >= 85 ? "Strong" : "Needs Improvement"}
            </span>
          </div>

          {/* Compliance flags trend chart */}
          <div ref={chartRef} className="w-full h-[170px] bg-white rounded-xl p-2 border border-slate-100 shadow-inner">
            {chartsReady && hasComplianceTrend ? (
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <BarChart data={complianceTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 9, fontWeight: 550 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 9, fontWeight: 550 }}
                  />
                  <Tooltip content={<CompTrendTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingTop: 4 }}
                  />
                  <Bar dataKey="created" name="New Flags" fill="#E61C24" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                {hasComplianceTrend ? "Loading chart..." : "No compliance flag data yet"}
              </div>
            )}
          </div>

          {/* Milestone completion mini-chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-extrabold text-slate-950 text-[10px] uppercase tracking-widest">
                Milestone Completions (6-Month)
              </h4>
            </div>
            <div className="w-full h-[90px] bg-white rounded-xl p-2 border border-slate-100 shadow-inner">
              {chartsReady && hasMilestoneTrend ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <LineChart data={milestoneCompletedTrend} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748b", fontSize: 8, fontWeight: 550 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#64748b", fontSize: 8, fontWeight: 550 }}
                    />
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
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
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
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">National EHS Dual-Signoff Workflow Workflow</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-[#E61C24] text-white flex items-center justify-center text-xs font-bold font-mono">1</span>
                  <span className="font-semibold text-xs text-slate-850">Technician Uploads</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Technician logs their JSA, PPE audit, or Heights Permits using raw text. Run AI compliance verification with Gemini.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-mono">2</span>
                  <span className="font-semibold text-xs text-slate-850">Contractor Approval</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Contractor Safety Lead reviews the report. Approving moves status to <span className="font-semibold">Pending Central Approval</span>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold font-mono">3</span>
                  <span className="font-semibold text-xs text-slate-850">Central Audit</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  HQ Safety Lead examines comments and officially grants full compliance validation, boosting the technician&apos;s official record safety rating.
                </p>
              </div>

            </div>
          </div>

          {/* Log feed system alert notifications — full width */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#E61C24] inline-block mr-2 animate-pulse" />
                Audit Alert Log Feed
              </h3>
              <button onClick={handleClearBroadcast} className="text-[10px] text-slate-500 hover:text-[#E61C24] font-bold">Mark All Read</button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {safeNotifications.length > 0 ? safeNotifications.map((n) => (
                <div key={n.id} className="text-xs space-y-1.5 p-3 rounded-lg bg-slate-50/80 border border-slate-100 hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 leading-tight">{safeString(n.title)}</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {(() => {
                        try {
                          return new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        } catch {
                          try { return safeString(n.createdAt); } catch { return "Unknown"; }
                        }
                      })()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">{safeString(n.message)}</p>
                </div>
              )) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  No recent alerts. All clear.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Rigging compliance alerts feed right panel */}
        <div className="space-y-6">

          {/* Pending documents card sidebar list */}
          <div className="bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-950 uppercase tracking-widest text-sm">
                {isTechnician ? "Cert Verification" : "Audit Queue"}
              </h3>
              <button onClick={() => navigateTo("ehs")} className="text-[10px] font-bold text-[#E61C24] hover:underline">View Grid</button>
            </div>
            <div className="p-6 space-y-4">
              {pendingDocuments.slice(0, 3).map((d: TechnicianDocument) => (
                <div key={d.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-red-50 text-[#E61C24] font-bold px-2 py-0.5 rounded-full tracking-wider">{d.type}</span>
                    <span className="text-[10px] font-mono text-slate-400">{d.uploadDate}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-950 mb-0.5">{d.fileName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Tech: {d.technicianName}</p>
                  </div>
                  <div className="pt-2">
                     <button
                       onClick={() => {
                         setViewingDoc(d);
                         navigateTo("ehs");
                       }}
                       className="w-full flex justify-center items-center py-2 bg-slate-900 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-slate-800 transition"
                     >
                       <Eye className="w-3.5 h-3.5 mr-1.5" /> {isTechnician ? "Check Status" : "Open Audit"}
                     </button>
                  </div>
                </div>
              ))}

              {pendingDocuments.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  {isTechnician ? "All your certs are verified. Great!" : "Zero pending safety checks. Excellent!"}
                </div>
              )}
            </div>
          </div>

          {/* Log feed system alert notifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Audit Alert Log Feed</h3>
              <button onClick={handleClearBroadcast} className="text-[10px] text-slate-500 hover:text-[#E61C24]">Mark Read</button>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {safeNotifications.map((n) => (
                <div key={n.id} className="text-xs space-y-1 p-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 leading-tight">{safeString(n.title)}</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {(() => {
                        try {
                          return new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        } catch {
                          try { return safeString(n.createdAt); } catch { return "Unknown"; }
                        }
                      })()}
                    </span>
                  </div>
                  <p className="text-65 text-slate-500 leading-tight">{safeString(n.message)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default DashboardView;
