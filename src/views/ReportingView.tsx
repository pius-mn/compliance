import React, { useState, useMemo, useCallback } from "react";
import { 
  FileText, 
  Download, 
  RefreshCw, 
  SlidersHorizontal, 
  CheckCircle, 
  TrendingUp, 
  Printer, 
  Sparkles,
  Info,
  Shield,
  Leaf,
  Clock,
  AlertTriangle,
  CheckCircle2,
  LucideIcon
} from "lucide-react";
import { PaginationControls } from "../components/PaginationControls";
import { DailyNotesHistory } from "../components/DailyNotesHistory";
import { 
  Role, 
  Project, 
  TechnicianProfile, 
  TechnicianDocument, 
  Contractor, 
  Milestone, 
  User,
  ComplianceFlag
} from "../types";
import { TOTAL_MILESTONES } from "../lib/constants";
import { safeNumber, safeString, getDocStatus } from "../utils/helpers";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

export interface ReportingViewProps {
  projects: Project[];
  technicians: TechnicianProfile[];
  documents: TechnicianDocument[];
  contractors: Contractor[];
  allUsers: User[];
  currentUser: User | null;
  complianceFlags?: ComplianceFlag[];
  onTriggerScan?: () => void;
  onResolveFlag?: (flagId: number, comments: string) => void;
  milestones?: Milestone[];
}

// --- Shared style/data helpers -------------------------------------------
// These pull out logic that used to be re-derived inline for every row
// (compliance flag icon/severity colors, milestone badges, clearance
// evaluation, expiration urgency tiers) plus a couple of small reusable
// pieces (LabeledSelect, KpiCard) so the filter panel and KPI grid aren't
// five/six near-identical blocks of JSX.

function getFlagIconMeta(standard: string): { Icon: LucideIcon; color: string } {
  if (standard === "OSHA") return { Icon: Shield, color: "text-red-500 dark:text-red-400" };
  if (standard === "EPA" || standard === "NEMA") return { Icon: Leaf, color: "text-emerald-500 dark:text-emerald-400" };
  if (standard === "Regulatory") return { Icon: Clock, color: "text-indigo-500 dark:text-indigo-400" };
  return { Icon: Info, color: "text-slate-500 dark:text-slate-400" };
}

function getSeverityBadgeClasses(severity: string) {
  if (severity === "High") {
    return "bg-red-50 text-red-700 border border-red-150 font-extrabold dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
  }
  if (severity === "Medium") {
    return "bg-amber-50 text-amber-700 border border-amber-150 font-bold dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
  }
  if (severity === "Low") {
    return "bg-blue-50 text-blue-700 border border-blue-150 font-medium dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function getMilestoneBadgeClasses(status: string) {
  if (status === "In Progress") return "bg-blue-50 text-blue-700 border border-blue-150 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
  if (status === "Blocked") return "bg-red-50 text-red-700 border border-red-150 animate-pulse dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 border border-emerald-150 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  return "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
}

function getClearanceEvaluation(averageScore: number): { status: string; style: string } {
  if (averageScore < 70) {
    return { status: "Suspended Site Access", style: "bg-red-50 text-red-800 border-red-150 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" };
  }
  if (averageScore < 80) {
    return { status: "Needs Inspection", style: "bg-amber-50 text-amber-800 border-amber-150 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20" };
  }
  return { status: "Cleared", style: "bg-emerald-50 text-emerald-800 border-emerald-150 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" };
}

function getUrgencyMeta(remainingDays: number, isExpired: boolean): { badge: string; label: string } {
  if (isExpired) {
    return {
      badge: "bg-red-50 text-red-700 border border-red-150 font-black dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
      label: "CRITICAL: EXPIRED",
    };
  }
  if (remainingDays <= 15) {
    return {
      badge: "bg-amber-50 text-amber-700 border border-amber-150 font-bold dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      label: "IMMEDIATE SLA EXPIRY",
    };
  }
  if (remainingDays <= 30) {
    return {
      badge: "bg-yellow-50 text-yellow-700 border border-yellow-150 font-semibold dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20",
      label: "WARNING WINDOW",
    };
  }
  return {
    badge: "bg-green-50 text-green-700 border border-green-150 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
    label: "Low Risk",
  };
}

/** Shared CSV download trigger — was duplicated verbatim (Blob → object URL →
 * throwaway <a> → click → cleanup) across all five export handlers below. */
function downloadCSV(filenamePrefix: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Safely formats a date-ish value, falling back to the raw string then "Unknown". */
function formatDateSafe(value: unknown): string {
  try {
    return new Date(value as string).toLocaleString();
  } catch {
    try {
      return safeString(value);
    } catch {
      return "Unknown";
    }
  }
}

const selectClasses =
  "text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-200 outline-none w-full focus:bg-white dark:focus:bg-slate-900 focus:border-[#E61C24] disabled:opacity-75 disabled:cursor-not-allowed";

function LabeledSelect({
  label, value, onChange, disabled, children,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 block mb-1">
        {label}
      </label>
      <select value={value} onChange={onChange} disabled={disabled} className={selectClasses}>
        {children}
      </select>
    </div>
  );
}

interface KpiCardProps {
  value: React.ReactNode;
  swatchClasses: string;
  label: string;
  headline: React.ReactNode;
  sublabel?: React.ReactNode;
  sublabelClasses?: string;
}

function KpiCard({ value, swatchClasses, label, headline, sublabel, sublabelClasses }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs flex items-center gap-4">
      <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-lg border ${swatchClasses}`}>
        {value}
      </div>
      <div className="min-w-0">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold">{label}</span>
        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate block">{headline}</span>
        {sublabel && (
          <div className={sublabelClasses || "text-[10px] text-slate-500 dark:text-slate-400 mt-0.5"}>{sublabel}</div>
        )}
      </div>
    </div>
  );
}

/** Shared CSV-safe-string helper used by all export handlers. */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = "";
  try {
    str = safeString(val);
  } catch {
    str = "[Object]";
  }
  str = str.replace(/"/g, '""');
  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

// --- Single compliance-flag card, memoized. The resolution-notes textarea's
// draft text used to live in the parent (`resolutionInputText`), so every
// keystroke re-rendered the entire paginated flag list (up to 10 cards,
// each re-deriving its icon/severity styling). Localizing the draft text
// inside the card itself means only the one open card re-renders. ---

interface ComplianceFlagCardProps {
  flag: ComplianceFlag;
  isResolving: boolean;
  onStartResolving: (flagId: number) => void;
  onCancelResolving: () => void;
  onSubmitResolution: (flagId: number, comments: string) => void;
}

const ComplianceFlagCard = React.memo(function ComplianceFlagCard({
  flag,
  isResolving,
  onStartResolving,
  onCancelResolving,
  onSubmitResolution,
}: ComplianceFlagCardProps) {
  const [draftText, setDraftText] = useState("");
  const { Icon: FlagIcon, color: iconColor } = getFlagIconMeta(flag.standard);
  const severityBadge = getSeverityBadgeClasses(flag.severity);

  return (
    <div className="p-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition">
      <div className="flex items-start gap-3.5">
        <div className={`p-2 bg-slate-100 dark:bg-slate-800 rounded-xl ${iconColor} mt-0.5 shadow-3xs border border-slate-200/50 dark:border-slate-700/50 shrink-0`}>
          <FlagIcon className="w-5 h-5" />
        </div>

        <div className="flex-grow min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[13px]">{flag.ruleName}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase font-semibold ${severityBadge}`}>
              {flag.severity}
            </span>
            <span className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
              {flag.standard}
            </span>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 sm:ml-auto font-medium">
              Flagged: {formatDateSafe(flag.flaggedAt)}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mt-1">
            {flag.description}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500 dark:text-slate-400 font-bold">
              <span className="uppercase tracking-wider text-[9px] text-slate-500 dark:text-slate-400 font-mono">Linked Entity:</span>
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded capitalize font-mono text-[10px]">
                {flag.targetType}
              </span>
              <span className="text-slate-800 dark:text-slate-200 font-bold italic">&quot;{flag.targetName}&quot;</span>
            </div>

            {flag.status === "Active" ? (
              <div>
                {isResolving ? (
                  <div className="mt-3 bg-indigo-50/60 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20 space-y-2.5 max-w-xl">
                    <span className="text-[11px] font-extrabold text-indigo-900 dark:text-indigo-300 block uppercase tracking-wider font-mono">
                      File Official Resolution Corrective Action
                    </span>
                    <textarea
                      className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 font-medium text-slate-900 dark:text-slate-100"
                      rows={2}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Please detail the corrective actions filed (e.g. Technician safety training program completed, valid NEMA certificate uploaded, or field safety equipment checked)..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={onCancelResolving}
                        className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-[11px] font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onSubmitResolution(flag.id, draftText);
                          setDraftText("");
                        }}
                        disabled={!draftText.trim()}
                        className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition disabled:opacity-50"
                      >
                        Submit Compliance Audit Log
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onStartResolving(flag.id)}
                    className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-500/20 text-[10.5px] font-extrabold rounded-lg transition"
                  >
                    Resolve Warning Flag
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 bg-emerald-50/70 dark:bg-emerald-500/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-500/20 w-full text-left">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>RESOLVED AUDIT SIGN-OFF</span>
                </div>
                {flag.resolvedAt && (
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block font-semibold mt-0.5">
                    Closed on: {formatDateSafe(flag.resolvedAt)}
                  </span>
                )}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 italic font-medium">
                  <strong>Correction Notes:</strong> {flag.resolutionComments || "Approved during regular safety cycle checks."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Single expiring-document row, memoized. Marking one row "notified"
// previously lived in parent state (`notifiedDocs`), so clicking the button
// on any one row re-rendered and re-derived urgency styling for every row
// in the table. ---

interface ExpiringDocRowProps {
  doc: TechnicianDocument & { remainingDays: number };
  phone: string;
  docContractor: string;
  isNotified: boolean;
  onNotify: (docId: number) => void;
}

const ExpiringDocRow = React.memo(function ExpiringDocRow({ doc, phone, docContractor, isNotified, onNotify }: ExpiringDocRowProps) {
  const isExpired = doc.remainingDays < 0;
  const { badge: urgencyBadge, label: urgencyLabel } = getUrgencyMeta(doc.remainingDays, isExpired);

  return (
    <tr className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition">
      <td className="p-3.5 pl-5">
        <div className="font-extrabold text-slate-900 dark:text-slate-100">{doc.technicianName}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{phone || "+254 No Phone"}</div>
      </td>
      <td className="p-3.5 font-bold text-slate-600 dark:text-slate-300">{docContractor}</td>
      <td className="p-3.5">
        <div className="font-bold text-slate-800 dark:text-slate-200">{doc.type}</div>
        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">{doc.fileName}</div>
      </td>
      <td className="p-3.5 font-bold font-mono text-slate-700 dark:text-slate-300">{doc.expiryDate}</td>
      <td className="p-3.5">
        {isExpired ? (
          <span className="text-red-700 dark:text-red-400 font-extrabold flex items-center gap-1 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired {Math.abs(doc.remainingDays)}d ago
          </span>
        ) : (
          <span className="text-slate-800 dark:text-slate-200 font-extrabold pl-0.5 text-[11px]">
            {doc.remainingDays} days remaining
          </span>
        )}
      </td>
      <td className="p-3.5 text-center">
        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-extrabold ${urgencyBadge}`}>
          {urgencyLabel}
        </span>
      </td>
      <td className="p-3.5 pr-5 text-right">
        {isNotified ? (
          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold border border-emerald-150 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] shadow-3xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Alert Dispatched
          </span>
        ) : (
          <button
            onClick={() => onNotify(doc.id)}
            className={`px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-[#E61C24]/10 hover:text-[#E61C24] dark:hover:text-red-400 hover:border-[#E61C24]/50 border border-indigo-150 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-extrabold rounded-lg transition shadow-3xs flex items-center gap-1.5 ml-auto ${
              isExpired ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20" : ""
            }`}
          >
            Send SLA Alert
          </button>
        )}
      </td>
    </tr>
  );
});

// --- Single site-clearance ledger row, memoized for the same reason as the
// rows above — keeps this table inert when unrelated filter/panel state
// elsewhere in the view changes. ---

interface SiteClearanceRowProps {
  project: Project;
  partnerName: string;
  leadName: string;
  ehsOfficer: string;
  currentMilestoneTitle: string;
  currentMilestoneStatus: string | null;
  averageScore: number;
  crewCount: number;
}

const SiteClearanceRow = React.memo(function SiteClearanceRow({
  project,
  partnerName,
  leadName,
  ehsOfficer,
  currentMilestoneTitle,
  currentMilestoneStatus,
  averageScore,
  crewCount,
}: SiteClearanceRowProps) {
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
      <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">
        <div className="truncate max-w-sm">{project.name}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{project.startDate} to {project.endDate}</div>
      </td>
      <td className="p-4 font-medium text-slate-600 dark:text-slate-300">{partnerName}</td>
      <td className="p-4">
        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={currentMilestoneTitle}>{currentMilestoneTitle}</div>
        {currentMilestoneStatus && (
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${getMilestoneBadgeClasses(currentMilestoneStatus)}`}>
            {currentMilestoneStatus}
          </span>
        )}
      </td>
      <td className="p-4 text-slate-500 dark:text-slate-400">{leadName}</td>
      <td className="p-4 text-slate-500 dark:text-slate-400">{ehsOfficer}</td>
      <td className="p-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className={`text-[11px] font-bold ${averageScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : averageScore >= 70 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
            {averageScore}%
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal whitespace-nowrap">avg ({crewCount} crew)</span>
        </div>
      </td>
    </tr>
  );
});

const ReportingView: React.FC<ReportingViewProps> = React.memo(function ReportingView({
  projects,
  technicians,
  documents,
  contractors,
  allUsers,
  currentUser,
  complianceFlags = [],
  onTriggerScan,
  onResolveFlag,
  milestones = []
}) {
  // Filters state
  const [selectedContractorId, setSelectedContractorId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");


  // Compliance Engine Panel states
  const [complianceStandardFilter, setComplianceStandardFilter] = useState<string>("all");
  const [complianceSeverityFilter, setComplianceSeverityFilter] = useState<string>("all");
  const [complianceStatusFilter, setComplianceStatusFilter] = useState<string>("Active");
  const [compFlagsPage, setCompFlagsPage] = useState(1);
  const COMP_FLAGS_PER_PAGE = 10;
  const [resolvingFlagId, setResolvingFlagId] = useState<number | null>(null);

  // Document Expiration Predictor States
  const [expirationDays, setExpirationDays] = useState<string>("30");
  const [expiredOnlyFilter, setExpiredOnlyFilter] = useState<boolean>(false);
  const [expirationContractorFilter, setExpirationContractorFilter] = useState<string>("all");
  const [notifiedDocs, setNotifiedDocs] = useState<Record<string, boolean>>({});
  
  // AI report generation state
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiReportOutput, setAiReportOutput] = useState<string | null>(null);

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedContractorId("all");
    setSelectedProjectId("all");
  };

  // Compliance flag resolution flow — stable callbacks so ComplianceFlagCard's
  // React.memo actually skips re-rendering cards that aren't being edited.
  const handleStartResolving = useCallback((flagId: number) => {
    setResolvingFlagId(flagId);
  }, []);
  const handleCancelResolving = useCallback(() => {
    setResolvingFlagId(null);
  }, []);
  const handleSubmitResolution = useCallback((flagId: number, comments: string) => {
    if (onResolveFlag) {
      onResolveFlag(flagId, comments);
      setResolvingFlagId(null);
    }
  }, [onResolveFlag]);

  const handleNotifyDoc = useCallback((docId: number) => {
    setNotifiedDocs(prev => ({ ...prev, [docId]: true }));
  }, []);

  // Contractor isolation security constraints (Contractor Managers / Contractor Safety Leads can only view their own contractor)
  const isCentral = currentUser?.isCentral ?? true;
  const activeContractorId = isCentral ? selectedContractorId : (currentUser?.contractorId || "all");

  // Filtered lists
  const filteredProjects = useMemo(() => {
    return (projects || []).filter(p => {
      if (!isCentral && p.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(p.contractorId) !== activeContractorId) return false;
      return true;
    });
  }, [projects, activeContractorId, isCentral, currentUser]);

  const filteredTechnicians = useMemo(() => {
    return (technicians || []).filter(t => {
      // Find technician's user or check contractorId mapping
      const techUser = (allUsers || []).find(u => u.id === t.userId);
      if (!techUser) return false;
      
      if (!isCentral && techUser.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(techUser.contractorId) !== activeContractorId) return false;
      return true;
    });
  }, [technicians, activeContractorId, isCentral, currentUser, allUsers]);

  const filteredDocs = useMemo(() => {
    return (documents || []).filter(d => {
      if (!isCentral && d.contractorId !== currentUser?.contractorId) return false;
      if (activeContractorId !== "all" && String(d.contractorId) !== String(activeContractorId)) return false;
      return true;
    });
  }, [documents, activeContractorId, isCentral, currentUser]);

  // Memoized filtered list of compliance flags
  const filteredFlags = useMemo(() => {
    return (complianceFlags || []).filter(flag => {
      // Contractor filtering
      if (!isCentral) {
        if (flag.targetType === "project") {
          const p = (projects || []).find(proj => proj.id === flag.targetId);          if (p && p.contractorId !== currentUser?.contractorId) return false;
          } else if (flag.targetType === "document") {
          const d = (documents || []).find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = (technicians || []).find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = (allUsers || []).find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== currentUser?.contractorId) return false;
          }
        }
      } else if (activeContractorId !== "all") {
        if (flag.targetType === "project") {
          const p = (projects || []).find(proj => proj.id === flag.targetId);          if (p && p.contractorId !== activeContractorId) return false;
          } else if (flag.targetType === "document") {
          const d = (documents || []).find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = (technicians || []).find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = (allUsers || []).find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== activeContractorId) return false;
          }
        }
      }

      // Standard filtering
      if (complianceStandardFilter !== "all" && flag.standard !== complianceStandardFilter) return false;

      // Severity filtering
      if (complianceSeverityFilter !== "all" && flag.severity !== complianceSeverityFilter) return false;

      // Status filtering
      if (complianceStatusFilter !== "all" && flag.status !== complianceStatusFilter) return false;

      return true;
    });
  }, [complianceFlags, projects, documents, technicians, allUsers, currentUser, isCentral, activeContractorId, complianceStandardFilter, complianceSeverityFilter, complianceStatusFilter]);

  // Reset pagination when filters change
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompFlagsPage(1);
  }, [complianceStandardFilter, complianceSeverityFilter, complianceStatusFilter, activeContractorId]);

  // Paginate filtered flags
  const paginatedFlags = useMemo(
    () => filteredFlags.slice(
      (compFlagsPage - 1) * COMP_FLAGS_PER_PAGE,
      compFlagsPage * COMP_FLAGS_PER_PAGE
    ),
    [filteredFlags, compFlagsPage]
  );

  // Memoized unresolved high-risk compliance flags
  const unresolvedHighRiskFlags = useMemo(() => {
    return (complianceFlags || []).filter(flag => {
      if (!flag) return false;
      // Filter strictly unresolved (Active) and High-Risk flags
      if (flag.status !== "Active") return false;
      if (flag.severity !== "High") return false;

      // Contractor security isolation check
      if (!isCentral) {
        if (flag.targetType === "project") {
          const p = projects.find(proj => proj.id === flag.targetId);
          if (p && p.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "document") {
          const d = documents.find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== currentUser?.contractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = technicians.find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = allUsers.find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== currentUser?.contractorId) return false;
          }
        }
      } else if (activeContractorId !== "all") {
        if (flag.targetType === "project") {
          const p = projects.find(proj => proj.id === flag.targetId);
          if (p && p.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "document") {
          const d = documents.find(doc => doc.id === flag.targetId);
          if (d && d.contractorId !== activeContractorId) return false;
        } else if (flag.targetType === "technician") {
          const t = technicians.find(tech => tech.id === flag.targetId);
          if (t) {
            const tUser = allUsers.find(u => u.id === t.userId);
            if (tUser && tUser.contractorId !== activeContractorId) return false;
          }
        }
      }
      return true;
    });
  }, [complianceFlags, projects, documents, technicians, allUsers, currentUser, isCentral, activeContractorId]);

  // Memoized expiring and expired documents report query
  const expiringDocsReport = useMemo(() => {
    const refDate = new Date();
    const thresholdDays = parseInt(expirationDays) || 0;

    const matched = (documents || []).filter((doc) => {
      if (!doc) return false;
      if (!doc.expiryDate) return false;

      // Contractor safety filtering
      if (!isCentral) {
        if (doc.contractorId !== currentUser?.contractorId) return false;
      } else if (expirationContractorFilter !== "all") {
        if (String(doc.contractorId) !== String(expirationContractorFilter)) return false;
      }
      return true;
    });

    return matched
      .map((doc) => {
        // expiryDate comes from MySQL DATE → JS Date → JSON, producing an ISO
        // string like "2026-06-13T21:00:00.000Z".  Plain Date.parse works fine
        // on both that and on a bare "YYYY-MM-DD" string.
        const expiry = new Date(doc.expiryDate as string);
        const diffTime = expiry.getTime() - refDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...doc,
          remainingDays: diffDays
        };
      })
      .filter((item) => {
        if (expiredOnlyFilter) {
          return item.remainingDays < 0;
        }
        return item.remainingDays <= thresholdDays;
      })
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [documents, expirationDays, expiredOnlyFilter, expirationContractorFilter, isCentral, currentUser]);

  // Compute calculated metrics
  const stats = useMemo(() => {
    // 1. Average safety score
    const scores = (filteredTechnicians || []).map(t => safeNumber(t.overallEhsScore));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    // 2. Audit approval rate
    const approvedCount = (filteredDocs || []).filter(d => getDocStatus(d) === "Approved").length;
    const totalDocs = (filteredDocs || []).length;
    const approvalRate = totalDocs ? Math.round((approvedCount / totalDocs) * 100) : 0;

    // 3. Highlighted Safety Flags
    // Flagged issues field was removed from documents table
    const issueCount = 0;

    // 4. Contractor Performance League
    const partnerStats = (contractors || []).map(b => {
      const contractorTechs = (technicians || []).filter(t => {
        const u = (allUsers || []).find(uUser => uUser.id === t.userId);
        return u?.contractorId === b.id;
      });
      const avgContractorScore = contractorTechs.length 
        ? Math.round(contractorTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / contractorTechs.length)
        : 0; // No crew assigned
      return {
        name: b.name,
        code: b.code,
        score: avgContractorScore,
        techCount: contractorTechs.length
      };
    });

    // 5. Total Rollout Distance
    const totalRolloutDistance = filteredProjects.reduce((sum, p) => sum + safeNumber(p.rolloutDistance), 0);

    return {
      avgScore,
      approvalRate,
      issueCount,
      totalDocs,
      partnerStats,
      totalRolloutDistance
    };
  }, [filteredTechnicians, filteredDocs, contractors, technicians, allUsers, filteredProjects]);

  // Visual Chart Data 1: Average Technician EHS Scores by Project
  const projectChartData = useMemo(() => {
    return (filteredProjects || []).map(p => {
      // Find technicians assigned to this project
      const assignedTechIds = p.assignedTechnicianIds || [];
      const projectTechs = (technicians || []).filter(t => assignedTechIds.includes(t.id));
      const avgProjScore = projectTechs.length
        ? Math.round(projectTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / projectTechs.length)
        : 0; // No crew assigned
      return {
        projectName: safeString(p.name).length > 20 ? safeString(p.name).substring(0, 20) + "..." : safeString(p.name),
        "Avg safety score (%)": avgProjScore,
        "Distance Coverage Index": Math.round((safeNumber(p.budget) / 1000) * 5) // distance scale factor
      };
    });
  }, [filteredProjects, technicians]);

  // Visual Chart Data 2: Safety Certificate Status distribution
  const documentStatusPieData = useMemo(() => {
    const statuses = ["Approved", "Pending Central Approval", "Pending Contractor Approval", "Rejected"];
    const colors = ["#18863A", "#F59E0B", "#3B82F6", "#E61C24"];
    
    return statuses.map((status, idx) => {
      const count = (filteredDocs || []).filter(d => getDocStatus(d) === status).length;
      return {
        name: status,
        value: count,
        color: colors[idx]
      };
    }).filter(item => item.value > 0); // hide zero records for prettier visualization
  }, [filteredDocs]);

  // Mock safety report auto-narrative generator based on live calculations (Simulated AI)
  const handleGenerateAiReport = () => {
    setIsAiGenerating(true);
    setAiReportOutput(null);
    setTimeout(() => {
      setIsAiGenerating(false);
      
      const flaggedTotal = stats.issueCount;
      const lowScores = (technicians || []).filter(t => t && t.overallEhsScore < 70);
      
      let summary = `### SAFARICOM EXECUTIVE SAFETY INTELLIGENCE REPORT\n`;
      summary += `**Generated for:** Unified EHS Portal (Safaricom Audit Ops)\n`;
      summary += `**Overall Scope Compliance Rating:** ${stats.avgScore}% Average Score / ${stats.approvalRate}% Audit Acceptance Rate\n\n`;
      
      summary += `#### 🚨 KEY SAFETY OBSERVATIONS & HEALTH VECTORS\n`;
      if (flaggedTotal > 0) {
        summary += `- **System alert:** Identified ${flaggedTotal} recurring compliance or safety item flags across active safety certification folders.\n`;
      } else {
        summary += `- **Perfect File Clearance:** No structural hazardous flags detected across currently filtered compliance archives.\n`;
      }
      
      if (lowScores.length > 0) {
        summary += `- **High-Risk Crew Warning:** ${lowScores.length} field engineers currently fall below the Safaricom 70% basic compliance safety threshold. Immediate retraining is strongly recommended prior to next tower climbs.\n`;
        summary += `  - *Flagged Crew members (Critical status):* ${lowScores.map(t => t.name).join(", ")}.\n`;
      } else {
        summary += `- **Superb Crew Compliance:** 100% of currently active technician field personnel are verified compliant with high safety scores.\n`;
      }

      summary += `\n#### 🏢 PARTNER PERFORMANCE COMPLIANCE BENCHMARK\n`;
      stats.partnerStats.forEach(p => {
        const rating = p.score >= 85 ? "Excellent (🎖️ Gold Standard)" : p.score >= 75 ? "Satisfactory" : "At Risk (⚠️ Under active review)";
        summary += `- **${p.name} (${p.code}):** Average score **${p.score}%** — Ranking: *${rating}* with ${p.techCount} deployed crew.\n`;
      });

      summary += `\n#### 📋 STRATEGIC AUDIT RECOMMENDATIONS\n`;
      summary += `1. **Enforce Mandatory Re-Auditing:** Require immediate safety upload verification checklists for any project holding an average compliance index under 80%.\n`;
      summary += `2. **Proactive Site Gatekeeping:** Establish strict biometric entry restrictions linked directly to the Technician overall EHS clearance score database.\n`;
      summary += `3. **Digital Log Archiving:** Maintain weekly visual proofs of certified working-at-height harnesses before dispatching subcontractors.\n`;

      setAiReportOutput(summary);
    }, 1100);
  };

  // Safe print preview handler
  const handlePrintReport = () => {
    window.print();
  };

  // Safe Export to CSV handler for active compliance flags and their status
  const handleExportCSV = () => {
    // We export filteredFlags to support filtering by standard/severity/status,
    // or the full complianceFlags list if they clear filters.
    const flagsToExport = filteredFlags;

    const headers = [
      "Flag ID",
      "Target ID",
      "Target Type",
      "Target Name",
      "Compliance Standard",
      "Rule Name",
      "Severity",
      "Status",
      "Description",
      "Flagged At",
      "Resolved At",
      "Resolution Comments"
    ];

    const csvRows = [
      headers.join(","),
      ...flagsToExport.map(flag => [
        escapeCSV(flag.id),
        escapeCSV(flag.targetId),
        escapeCSV(flag.targetType),
        escapeCSV(flag.targetName),
        escapeCSV(flag.standard),
        escapeCSV(flag.ruleName),
        escapeCSV(flag.severity),
        escapeCSV(flag.status),
        escapeCSV(flag.description),
        escapeCSV(flag.flaggedAt),
        escapeCSV(flag.resolvedAt || "N/A"),
        escapeCSV(flag.resolutionComments || "N/A")
      ].join(","))
    ];

    downloadCSV("safaricom_compliance_report", csvRows.join("\n"));
  };

  // Safe Export to CSV handler for expiring documents report
  const handleExportExpiringDocsCSV = () => {
    const headers = [
      "Holder Name",
      "Phone",
      "Regional Presence",
      "Document Type",
      "File Name",
      "Expiration Date",
      "Days Remaining",
      "Urgency Tier",
    ];

    const csvRows = [
      headers.join(","),
      ...expiringDocsReport.map(doc => {
        const docContractor = contractors.find(b => b.id === doc.contractorId)?.name || "N/A";
        const techProfile = technicians.find(t => t.id === doc.technicianId);
        const isExpired = doc.remainingDays < 0;
        const { label: urgencyLabel } = getUrgencyMeta(doc.remainingDays, isExpired);
        return [
          escapeCSV(doc.technicianName),
          escapeCSV(techProfile?.phone || ""),
          escapeCSV(docContractor),
          escapeCSV(doc.type),
          escapeCSV(doc.fileName),
          escapeCSV(doc.expiryDate),
          escapeCSV(isExpired ? `Expired ${Math.abs(doc.remainingDays)}d ago` : `${doc.remainingDays} days`),
          escapeCSV(urgencyLabel),
        ].join(",");
      }),
    ];

    downloadCSV("document_expiration_report", csvRows.join("\n"));
  };

  /** Derive milestone status label from milestonesCount (avoids needing milestones fetch). */
  const getMilestoneStatusFromCount = (mc: { total: number; completed: number } | undefined): string => {
    if (!mc || mc.total === 0) return "Not Started";
    if (mc.completed >= mc.total) return "Completed";
    if (mc.completed > 0) return "In Progress";
    return "Pending";
  };

  // Safe Export to CSV handler for site clearance ledger
  const handleExportSiteClearanceCSV = () => {
    const headers = [
      "Project",
      "Partner",
      "Milestone Status",
      "Progress",
      "Safaricom Lead",
      "Safety Lead",
      "Avg Safety Score (%)",
      "Crew Count",
      "Clearance Status",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredProjects.map(p => {
        const partnerName = contractors.find(b => b.id === p.contractorId)?.name || "Not assigned";
        const leadName = allUsers.find(u => u.id === p.projectLeadId)?.name || "Unassigned Lead";
        const ehsOfficer = allUsers.find(u => u.id === p.ehsOfficerId)?.name || "Unassigned EHS";
        const assignedIds = p.assignedTechnicianIds || [];
        const matchedTechs = (technicians || []).filter(t => t && assignedIds.includes(t.id));
        const averageScore = matchedTechs.length
          ? Math.round(matchedTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / matchedTechs.length)
          : 0;
        const hasCrew = matchedTechs.length > 0;
        const { status: evaluatedStatus } = hasCrew
          ? getClearanceEvaluation(averageScore)
          : { status: "No crew" };

        const mc = p.milestonesCount;
        const completed = mc?.completed ?? 0;
        const progress = `${completed} / ${TOTAL_MILESTONES}`;
        const milestoneStatus = getMilestoneStatusFromCount(mc);

        return [
          escapeCSV(p.name),
          escapeCSV(partnerName),
          escapeCSV(milestoneStatus),
          escapeCSV(progress),
          escapeCSV(leadName),
          escapeCSV(ehsOfficer),
          escapeCSV(averageScore),
          escapeCSV(matchedTechs.length),
          escapeCSV(evaluatedStatus),
        ].join(",");
      }),
    ];

    downloadCSV("site_clearance_ledger", csvRows.join("\n"));
  };

  // Safe Export to CSV handler for KPI grid data
  const handleExportKPICSV = () => {
    const rows = [
      ["Compliance Index", `${stats.avgScore}%`],
      ["Audit Approval Rate", `${stats.approvalRate}%`],
      ["Total Uploaded Cert Files", String(stats.totalDocs)],
      ["Active Hazard Flags", String(stats.issueCount)],
      ["Contractor Projects", String(filteredProjects.length)],
      ["Total Rollout Distance (km)", String(stats.totalRolloutDistance)],
      [],
      ["--- Partner Performance League ---", "", ""],
      ["Partner Name", "Score (%)", "Deployed Crew"],
      ...stats.partnerStats.map(p => [p.name, `${p.score}%`, String(p.techCount)]),
    ];

    downloadCSV("kpi_metrics", rows.map(r => r.join(",")).join("\n"));
  };

  // Safe Export to CSV handler for chart data
  const handleExportChartsCSV = () => {
    // Part 1: Project-wise safety scores
    const projectHeaders = ["Section", "Project Name", "Avg Safety Score (%)", "Distance Coverage Index"];
    const projectRows = projectChartData.map(d => [
      "Project Scores",
      escapeCSV(d.projectName),
      String(d["Avg safety score (%)"]),
      String(d["Distance Coverage Index"]),
    ]);

    // Part 2: Document status distribution
    const docHeaders = ["Section", "Document Status", "Count"];
    const docRows = documentStatusPieData.map(d => [
      "Doc Status Distribution",
      escapeCSV(d.name),
      String(d.value),
    ]);

    const csvRows = [
      projectHeaders.join(","),
      ...projectRows.map(r => r.join(",")),
      [],
      docHeaders.join(","),
      ...docRows.map(r => r.join(",")),
    ];

    downloadCSV("charts_data", csvRows.join("\n"));
  };

  // Safe Print to PDF handler for high-risk unresolved flags
  const handlePrintHighRiskFlags = () => {
    const contractorName = activeContractorId === "all" 
      ? "Safaricom Unified Network (All Partners)" 
      : (contractors.find(b => b.id === activeContractorId)?.name || "Contractor");

    const dateStr = new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short"
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    let tableRowsHtml = "";
    if (unresolvedHighRiskFlags.length > 0) {
      unresolvedHighRiskFlags.forEach((flag, index) => {
        const safe = (v: unknown) => {
          return safeString(v);
        };
        let flagDate = "Unknown";
        try {
          flagDate = new Date(safe(flag.flaggedAt)).toLocaleString();
        } catch { /* ignore */ }

        tableRowsHtml += `
          <div class="flag-card">
            <div class="flag-header">
              <div class="flag-title-block">
                <span class="flag-title">#${index + 1}: ${safe(flag.ruleName)}</span>
                <span class="flag-meta">Logged: ${flagDate} | Standard Focus: <strong>${safe(flag.standard)}</strong></span>
              </div>
              <span class="badge-high">High Risk</span>
            </div>
            <div class="flag-body">
              <p class="flag-desc">${safe(flag.description)}</p>
              <div class="flag-details-grid">
                <div class="detail-item"><strong>Target Type:</strong> <span style="text-transform: capitalize;">${safe(flag.targetType)}</span></div>
                <div class="detail-item"><strong>Target Name:</strong> <span>${safe(flag.targetName)}</span></div>
                <div class="detail-item"><strong>Compliance Rule ID:</strong> <span>${safe(flag.id)}</span></div>
                <div class="detail-item"><strong>Security Classification:</strong> <span>Active Unresolved</span></div>
              </div>
            </div>
          </div>
        `;
      });
    } else {
      tableRowsHtml = `
        <div class="no-flags">
          <div class="no-flags-title">✓ No Active High-Risk Flags</div>
          <p class="no-flags-text">
            Excellent! A real-time audit scan verifies that there are currently zero unresolved high-risk 
            compliance breaches or safety violations recorded for the selected operational scope. All critical 
            standards (OSHA, EPA, NEMA, and internal Safaricom guidelines) are fully clear.
          </p>
        </div>
      `;
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Safaricom EHS High-Risk Compliance Audit Summary</title>
        <style>
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background-color: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 40px;
            line-height: 1.5;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 3px solid #e11d48;
            padding-bottom: 15px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .logo-area h1 {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .logo-area h2 {
            font-size: 11px;
            font-weight: 600;
            color: #e11d48;
            margin: 3px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .info-area {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .info-area strong {
            color: #0f172a;
          }
          .title-banner {
            background-color: #fff1f2 !important;
            border: 1px solid #fecdd3;
            border-left: 5px solid #e11d48;
            padding: 15px 18px;
            border-radius: 6px;
            margin-bottom: 25px;
          }
          .title-banner h3 {
            font-size: 16px;
            color: #9f1239;
            margin: 0 0 4px 0;
            font-weight: 700;
          }
          .title-banner p {
            font-size: 12px;
            color: #881337;
            margin: 0;
            font-weight: 500;
          }
          .flag-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            overflow: hidden;
          }
          .flag-header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #cbd5e1;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .flag-title-block {
            display: flex;
            flex-direction: column;
          }
          .flag-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
          }
          .flag-meta {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          .badge-high {
            background-color: #e11d48 !important;
            color: #ffffff !important;
            font-size: 9px;
            font-weight: 850;
            padding: 3px 8px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .flag-body {
            padding: 14px 15px;
            background: #ffffff;
          }
          .flag-desc {
            font-size: 12.5px;
            color: #334155;
            line-height: 1.5;
            margin: 0 0 12px 0;
          }
          .flag-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 11px;
            background-color: #f1f5f9 !important;
            padding: 10px 12px;
            border-radius: 4px;
          }
          .detail-item strong {
            color: #0f172a;
          }
          .detail-item span {
            color: #475569;
          }
          .no-flags {
            text-align: center;
            padding: 40px;
            border: 2px dashed #cbd5e1;
            border-radius: 8px;
            background-color: #fafafa !important;
            margin-bottom: 30px;
          }
          .no-flags-title {
            font-size: 18px;
            color: #059669;
            font-weight: bold;
            margin: 0 0 8px 0;
          }
          .no-flags-text {
            font-size: 13px;
            color: #475569;
            max-w: 480px;
            margin: 0 auto;
            line-height: 1.5;
          }
          .signature-section {
            margin-top: 45px;
            page-break-inside: avoid;
          }
          .signature-title {
            font-size: 11px;
            font-weight: bold;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
          }
          .sig-block {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 12px;
            background-color: #f8fafc !important;
          }
          .sig-line {
            border-bottom: 1px solid #475569;
            margin-top: 35px;
            margin-bottom: 6px;
          }
          .sig-label {
            font-size: 10.5px;
            font-weight: 600;
            color: #334155;
          }
          .sig-sub {
            font-size: 9px;
            color: #64748b;
            margin-top: 1.5px;
          }
          .footer {
            margin-top: 45px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <h1>Safaricom</h1>
            <h2>Unified EHS & Compliance Operations</h2>
          </div>
          <div class="info-area">
            <div>Scope: <strong>${contractorName}</strong></div>
            <div>Generated: <strong>${dateStr}</strong></div>
            <div>Report Security: <strong>Safaricom Internal Strict Compliance</strong></div>
          </div>
        </div>

        <div class="title-banner">
          <h3>Unresolved High-Risk Compliance Audit Summary</h3>
          <p>This document presents a structured and detailed clearance report of all unresolved high-risk compliance warnings flagged across active technicians, documentation pools, and project rollout sites.</p>
        </div>

        ${tableRowsHtml}

        <div class="signature-section">
          <div class="signature-title">Review & Validation Approvals</div>
          <div class="signature-grid">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Safaricom Senior EHS Lead</div>
              <div class="sig-sub">Corporate HQ Operations</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Partner Safety Coordinator</div>
              <div class="sig-sub">Regional Infrastructure Team</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Independent Safety Auditor</div>
              <div class="sig-sub">Third Party Compliance Board</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <div>© 2026 Safaricom PLC • Unified EHS Portal (Reporting Module)</div>
          <div>Page 1 of 1</div>
          <div>Strictly Private & Confidential</div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(reportHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 450);
  };

  return (
    <div id="reporting_module_container" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 max-w-[1600px] w-full mx-auto">

      {/* Title block with actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-[#E61C24] text-[10px] font-extrabold uppercase rounded-full tracking-wider animate-pulse">
              Ops Insights
            </span>
            <span className="text-slate-400 font-mono text-[11px]">System Tool</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#E61C24] shrink-0" /> Unified EHS & Project Compliance Reports
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl">
            Interactive analytical suite providing high-fidelity oversight of partner compliance scores,
            safety certification approval times, and regional safety metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="print_report_btn"
            onClick={handlePrintReport}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-3xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print Audit Portfolio
          </button>

          <button
            id="ai_report_btn"
            onClick={handleGenerateAiReport}
            disabled={isAiGenerating}
            className="px-4 py-1.5 bg-[#E61C24] hover:bg-[#c2141a] text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            {isAiGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Safety Records...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 fill-white/10" /> Compile AI Executive Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-[#E61C24] dark:text-red-400" /> Filter Parameters
          </div>
          <button
            onClick={handleResetFilters}
            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-[#E61C24] dark:hover:text-red-400 font-semibold flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" /> Reset Filter Settings
          </button>
        </div>          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledSelect
            label="Filter by Partner Contractor:"
            value={String(activeContractorId)}
            onChange={(e) => setSelectedContractorId(e.target.value)}
            disabled={!isCentral}
          >
            <option value="all">Safaricom Unified Network (All Partners)</option>
            {contractors.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </LabeledSelect>

          <LabeledSelect
            label="Select Active Project Trace:"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="all">Analyze All Projects ({filteredProjects.length})</option>
            {filteredProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </LabeledSelect>
        </div>
      </div>

      {/* Key Metric KPI grid */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key Performance Indicators</span>
        <button
          onClick={handleExportKPICSV}
          className="px-2 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-sm"
          title="Export KPI metrics data to CSV"
        >
          <Download className="w-3 h-3" /> Export KPI Data
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        <KpiCard
          value={`${stats.avgScore}%`}
          swatchClasses="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
          label="Compliance Index"
          headline={stats.avgScore >= 85 ? "Optimum (Gold)" : stats.avgScore >= 75 ? "Robust" : "Pre-Critical Warning"}
          sublabel={<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><TrendingUp className="w-3 h-3" /> Tested field crew</span>}
        />
        <KpiCard
          value={`${stats.approvalRate}%`}
          swatchClasses="bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20"
          label="Audit Approval Success"
          headline={`${stats.totalDocs} uploaded cert files`}
          sublabel="Approved compliance submissions"
        />
        <KpiCard
          value={stats.issueCount}
          swatchClasses={stats.issueCount > 0
            ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
            : "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}
          label="Active Hazard Flags"
          headline={stats.issueCount > 0 ? "Hazards Flagged" : "Zero Issues Flagged"}
          sublabel="Extracted by intelligent review"
        />
        <KpiCard
          value={filteredProjects.length}
          swatchClasses="bg-rose-50 text-[#E61C24] border-rose-100 dark:bg-rose-500/10 dark:text-red-400 dark:border-rose-500/20"
          label="Contractor Projects"
          headline="Under Active Oversight"
          sublabel="Audited regional tower hubs"
        />
        <KpiCard
          value={
            <span className="flex flex-col items-center leading-none">
              {stats.totalRolloutDistance}
              <span className="text-[8px] font-bold text-sky-500 dark:text-sky-400 uppercase mt-0.5">km</span>
            </span>
          }
          swatchClasses="bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20"
          label="Total Rollout"
          headline="In Fibre Kilometers"
          sublabel="Aggregated fibre distance"
        />
      </div>

      {/* AI compiled summary dynamic output and charts */}
      {aiReportOutput && (
        <div className="bg-rose-50/70 dark:bg-rose-500/10 border border-rose-150 dark:border-rose-500/20 rounded-xl p-4 sm:p-5 shadow-3xs animate-fade-in text-slate-800 dark:text-slate-200 text-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 font-bold text-[#E61C24] dark:text-red-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#E61C24] dark:text-red-400 fill-rose-200 dark:fill-rose-500/20" /> Compiled Executive Summary Findings
            </div>
            <button
              onClick={() => setAiReportOutput(null)}
              className="text-[10px] hover:text-[#E61C24] dark:hover:text-red-400 text-slate-500 dark:text-slate-400 font-bold"
            >
              ✕ Hide Report Panel
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 sm:p-5 border border-slate-150 dark:border-slate-800 space-y-3 prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
            {aiReportOutput.split("\n").map((line, i) => {
              if (line.startsWith("### ")) {
                return <h3 key={i} className="text-sm font-extrabold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1.5 mt-2 uppercase tracking-wide">{line.replace("### ", "")}</h3>;
              }
              if (line.startsWith("#### ")) {
                return <h4 key={i} className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3 flex items-center gap-1">{line.replace("#### ", "")}</h4>;
              }
              if (line.startsWith("- ")) {
                return <p key={i} className="pl-4 border-l-2 border-red-500/30 my-1">{line.replace("- ", "")}</p>;
              }
              if (line.startsWith("  - ")) {
                return <p key={i} className="pl-8 text-[11px] text-slate-500 dark:text-slate-400 italic my-0.5">{line.replace("  - ", "")}</p>;
              }
              if (line.trim() === "") return <div key={i} className="h-1" />;
              return <p key={i} className="leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      )}

      {/* Daily Notes History — Management Analysis */}
      <DailyNotesHistory user={currentUser} />

      {/* Graphic Analytical Visualizations block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1: Project-wise EHS scores comparison */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">Project-wise Safety Score Index Comparison</h3>
            <button
              onClick={handleExportChartsCSV}
              className="px-2 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-sm shrink-0"
              title="Export chart data to CSV"
            >
              <Download className="w-3 h-3" /> Export Data
            </button>
          </div>

          <div className="h-[220px] sm:h-[250px] w-full">
            {projectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100} id="project_ehs_score_chart">
                <BarChart data={projectChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="projectName"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", color: "#fff", border: "none", borderRadius: "8px", fontSize: "10px" }}
                    labelStyle={{ fontWeight: "bold", color: "#94a3b8" }}
                  />
                  <Bar
                    dataKey="Avg safety score (%)"
                    fill="#E61C24"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-[11px] italic">
                No project score data available under current filter variables.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Safety Certificate Upload verification State distribution */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">Verification State Distribution (Safety Audits)</h3>
            <button
              onClick={handleExportChartsCSV}
              className="px-2 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-sm shrink-0"
              title="Export chart data to CSV"
            >
              <Download className="w-3 h-3" /> Export Data
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:h-[250px] items-center">
            <div className="col-span-1 md:col-span-7 h-[200px] md:h-full w-full">
              {documentStatusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100} id="doc_status_pie_chart">
                  <PieChart>
                    <Pie
                      data={documentStatusPieData}
                      cx="55%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {documentStatusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", color: "#fff", border: "none", borderRadius: "8px", fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-[11px] italic">
                  No certificate document statistics available.
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block font-mono">Legend Breakdown</span>
              {documentStatusPieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="capitalize truncate">{item.name}:</span>
                  <strong className="font-bold text-slate-800 dark:text-slate-100 text-xs shrink-0">{item.value}</strong>
                </div>
              ))}
              {documentStatusPieData.length === 0 && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">No submissions file queue logged representing active partner filters.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* AUTOMATED REGULATORY COMPLIANCE SYSTEM MONITOR (OSHA / EPA / NEMA) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
                Safaricom Compliance Engine (Daemon Active)
              </span>
            </div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 uppercase mt-1 flex items-center gap-1.5">
              <Shield className="w-5 h-5 text-[#E61C24] dark:text-red-400" /> Automated Policy & Regulatory Audit
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Periodic scanning engine mapping active operations against OSHA crew standards, NEMA/EPA environmental clearances, and Safaricom safety validation SLAs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              id="print_high_risk_pdf_btn"
              onClick={handlePrintHighRiskFlags}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
              title="Print a formatted, printer-friendly summary of all unresolved high-risk compliance flags"
            >
              <Printer className="w-3.5 h-3.5" /> Print to PDF
            </button>

            <button
              id="export_compliance_csv_btn"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm"
              title="Export active compliance flags and their status to a CSV file for external audit reporting"
            >
              <Download className="w-3.5 h-3.5" /> Export Compliance CSV
            </button>

            {onTriggerScan && (currentUser?.role === Role.SafaricomAdmin || currentUser?.role === Role.SafaricomEHSOfficer) && (
              <button
                id="sweep_scan_btn"
                onClick={onTriggerScan}
                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-extrabold text-xs rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition flex items-center gap-1.5 shadow-sm"
                title="Scan whole active database to look for newly active regulatory warnings"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sweep & Analyze Workspace
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Standard selector */}
          <div className="lg:col-span-5 flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 pr-1 shrink-0 font-mono">Standard:</span>
            {["all", "OSHA", "EPA", "Regulatory", "Safaricom Internal"].map((std) => (
              <button
                key={std}
                onClick={() => setComplianceStandardFilter(std)}
                className={`px-3 py-1 text-xs rounded-full font-bold transition whitespace-nowrap shrink-0 ${
                  complianceStandardFilter === std
                    ? "bg-[#E61C24] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {std === "all" ? "All Rules" : std}
              </button>
            ))}
          </div>

          {/* Severity Selector */}
          <div className="lg:col-span-4 flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono shrink-0">Severity:</span>
            <select
              value={complianceSeverityFilter}
              onChange={(e) => setComplianceSeverityFilter(e.target.value)}
              className="text-xs p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
            >
              <option value="all">All Severities</option>
              <option value="High">🔴 High Severity</option>
              <option value="Medium">🟡 Medium Severity</option>
              <option value="Low">🔵 Low Severity</option>
            </select>
          </div>

          {/* Status Selector Tabs (Active vs Resolved) */}
          <div className="lg:col-span-3 flex border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-100/60 dark:bg-slate-800/60 lg:ml-auto w-full lg:w-auto">
            <button
              onClick={() => {
                setComplianceStatusFilter("Active");
                setResolvingFlagId(null);
              }}
              className={`flex-1 px-3 py-1 text-xs rounded-md font-bold transition flex items-center justify-center gap-1 ${
                complianceStatusFilter === "Active"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-3xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Active ({(complianceFlags || []).filter(f => f && f.status === "Active").length})
            </button>
            <button
              onClick={() => {
                setComplianceStatusFilter("Resolved");
                setResolvingFlagId(null);
              }}
              className={`flex-1 px-3 py-1 text-xs rounded-md font-bold transition flex items-center justify-center gap-1 ${
                complianceStatusFilter === "Resolved"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-3xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved ({(complianceFlags || []).filter(f => f && f.status === "Resolved").length})
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-150 dark:divide-slate-800 flex-1 overflow-y-auto min-h-0">
          {paginatedFlags.map((flag) => (
            <ComplianceFlagCard
              key={flag.id}
              flag={flag}
              isResolving={resolvingFlagId === flag.id}
              onStartResolving={handleStartResolving}
              onCancelResolving={handleCancelResolving}
              onSubmitResolution={handleSubmitResolution}
            />
          ))}

          {paginatedFlags.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
              <div>
                <p className="font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                  No Policy Breaches Detected
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 max-w-sm mx-auto">
                  Excellent! All currently monitored active projects and documentations have completely passed OSHA & NEMA compliance audits under specified filters.
                </p>
              </div>
            </div>
          )}

          <PaginationControls
            currentPage={compFlagsPage}
            setCurrentPage={setCompFlagsPage}
            totalItems={filteredFlags.length}
            itemsPerPage={COMP_FLAGS_PER_PAGE}
          />
        </div>
      </div>

      {/* TECHNICIAN SAFETY DOCUMENT EXPIRATION AUDIT & PROGNOSIS REPORT */}
      <div id="document-expiration-report" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-3xs overflow-hidden my-6">
        <div className="p-4 sm:p-5 border-b border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-[#E61C24]/10 text-[#E61C24] dark:text-red-400 rounded border border-[#E61C24]/20 uppercase tracking-widest font-mono">
                  Predictive SLA Watch
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Reference Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 uppercase flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-[#E61C24] dark:text-red-400" /> Document Expiration Forecasting Report
              </h3>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                Dynamically audit active technician certificates and credentials. Filter or input a customized day-count window to capture impending expirations and prevent unauthorized field work.
              </p>
            </div>
            <button
              onClick={handleExportExpiringDocsCSV}
              className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-sm shrink-0 self-start sm:self-center"
              title="Export expiring documents data to CSV"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          </div>
        </div>

        {/* Prediction Controls Section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Dynamic Days Range Selector */}
          <div className="lg:col-span-5 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono block">Forecast Threshold (Days):</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={expirationDays}
                onChange={(e) => {
                  setExpiredOnlyFilter(false);
                  setExpirationDays(e.target.value.replace(/\D/g, ""));
                }}
                disabled={expiredOnlyFilter}
                className="px-3 py-1.5 w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono outline-none text-slate-800 dark:text-slate-100 focus:border-[#E61C24] disabled:opacity-60"
                placeholder="e.g. 30"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">days out</span>

              {/* Quick buttons */}
              <div className="flex gap-1 items-center sm:ml-2 sm:border-l border-slate-200 dark:border-slate-700 sm:pl-3">
                {[15, 30, 60, 90].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setExpiredOnlyFilter(false);
                      setExpirationDays(preset.toString());
                    }}
                    className={`px-2 py-1 text-[10.5px] rounded font-bold transition ${
                      !expiredOnlyFilter && expirationDays === preset.toString()
                        ? "bg-[#18863A] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {preset}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status Filter Toggles (Expired Only vs Impending) */}
          <div className="lg:col-span-4 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono block">Auditing State Filter:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExpiredOnlyFilter(false)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                  !expiredOnlyFilter
                    ? "bg-slate-900 dark:bg-slate-700 border-slate-900 dark:border-slate-700 text-white"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Expiring &lt;= {expirationDays || "0"} Days
              </button>
              <button
                onClick={() => setExpiredOnlyFilter(true)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1 ${
                  expiredOnlyFilter
                    ? "bg-red-500 border-red-500 text-white shadow-3xs"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Already Expired
              </button>
            </div>
          </div>

          {/* Regional isolation option */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono block">Hub Region presence:</label>
            {isCentral ? (
              <select
                value={expirationContractorFilter}
                onChange={(e) => setExpirationContractorFilter(e.target.value)}
                className="text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
              >
                <option value="all">Global Safaricom Network</option>
                {contractors.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs py-1.5 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold capitalize">
                {contractors.find(b => b.id === currentUser?.contractorId)?.name || "Local Contractor Unit"}
              </div>
            )}
          </div>
        </div>

        {/* Expiring List Table results */}
        <div className="overflow-x-auto">
          {expiringDocsReport.length > 0 ? (
            <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 divide-y divide-slate-150 dark:divide-slate-800 min-w-[760px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-3.5 pl-5">Holder / Contact</th>
                  <th className="p-3.5">Regional presence</th>
                  <th className="p-3.5">Document Audit Name</th>
                  <th className="p-3.5">Expiration Date</th>
                  <th className="p-3.5">Days Left (Prognosis)</th>
                  <th className="p-3.5 text-center">Urgency Tier</th>
                  <th className="p-3.5 pr-5 text-right">SLA Action Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expiringDocsReport.map((doc) => {
                  const docContractor = contractors.find(b => b.id === doc.contractorId)?.name || "N/A";
                  const techProfile = technicians.find(t => t.id === doc.technicianId);

                  return (
                    <ExpiringDocRow
                      key={doc.id}
                      doc={doc}
                      phone={techProfile?.phone || ""}
                      docContractor={docContractor}
                      isNotified={!!notifiedDocs[doc.id]}
                      onNotify={handleNotifyDoc}
                    />
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 py-16 flex flex-col items-center justify-center space-y-3.5 bg-slate-50/20 dark:bg-slate-800/10">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
              <div className="space-y-1">
                <p className="font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs font-mono">
                  Safe Expiration State
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-md mx-auto">
                  No active credentials expire within {expiredOnlyFilter ? "the selected past window" : `${expirationDays || "0"} days`}. Regional field safety compliance is secure!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official Project Clearance and safety Gate Audit table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-3xs">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 uppercase">Subcontractor Site Clearance Ledger</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Visual representation of real-time project risk thresholds and crew compliance rates.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportSiteClearanceCSV}
              className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-sm"
              title="Export site clearance ledger data to CSV"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
            <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full shrink-0">
              Records: {filteredProjects.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table id="site_clearance_table" className="w-full text-xs text-left text-slate-700 dark:text-slate-300 min-w-[760px]">
            <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-150 dark:border-slate-800 text-[9px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-4">Active Hub / Project</th>
                <th className="p-4">Assigned Partner</th>
                <th className="p-4">Current Milestone</th>
                <th className="p-4">Safaricom Lead</th>
                <th className="p-4">Safety Lead</th>
                <th className="p-4 text-center">Safety Rating Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProjects.map((p) => {
                const partnerName = contractors.find(b => b.id === p.contractorId)?.name || "Not assigned";
                const leadName = allUsers.find(u => u.id === p.projectLeadId)?.name || "Unassigned Lead";
                const ehsOfficer = allUsers.find(u => u.id === p.ehsOfficerId)?.name || "Unassigned EHS";

                // average safety rating for crew profiles
                const assignedIds = p.assignedTechnicianIds || [];
                const matchedTechs = (technicians || []).filter(t => t && assignedIds.includes(t.id));
                const averageScore = matchedTechs.length
                  ? Math.round(matchedTechs.reduce((sum, t) => sum + safeNumber(t.overallEhsScore), 0) / matchedTechs.length)
                  : 0;

                const mc = p.milestonesCount;
                const currentMilestoneTitle = getMilestoneStatusFromCount(mc);
                const currentMilestoneStatus = mc && mc.total > 0 ? currentMilestoneTitle : null;

                return (
                  <SiteClearanceRow
                    key={p.id}
                    project={p}
                    partnerName={partnerName}
                    leadName={leadName}
                    ehsOfficer={ehsOfficer}
                    currentMilestoneTitle={currentMilestoneTitle}
                    currentMilestoneStatus={currentMilestoneStatus}
                    averageScore={averageScore}
                    crewCount={matchedTechs.length}
                  />
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="bg-slate-50/50 dark:bg-slate-800/20 p-12 text-center text-slate-500 dark:text-slate-400 text-xs italic">
                    There are no recorded project scopes matching the compliance metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
});

export default ReportingView;
