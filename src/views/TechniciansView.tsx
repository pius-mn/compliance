import React, { useState } from "react";
import { User, TechnicianProfile, TechnicianDocument, WorkRole, Role, DocumentType, Contractor } from "../types";
import { TechnicianDetails } from "../components/TechnicianDetailsModal";
import { AddTechnicianForm } from "../components/AddTechnicianModal";
import {
  Plus,
  Search,
  Users,
  ShieldCheck,
  Activity,
  ShieldAlert,
  SlidersHorizontal,
  LucideIcon,
} from "lucide-react";
import { PaginationControls } from "../components/PaginationControls";

interface TechniciansViewProps {
  user: User | null;
  technicians: TechnicianProfile[];
  filteredTechnicians: TechnicianProfile[];
  techsTotal: number;
  techSearch: string;
  setTechSearch: React.Dispatch<React.SetStateAction<string>>;
  contractors: Contractor[];
  documents: TechnicianDocument[];
  onUpload: (technicianId: number | string, docTypeName?: string) => void;
  onAddTechnician: (tech: { name: string; email: string; phone: string; specialization: string }) => Promise<void>;
  onUpdateTechnician: (id: number | string, tech: { name: string; email?: string; phone: string; specialization: string }) => Promise<void>;
  onDeleteTechnician: (id: number | string) => Promise<void>;
  actionLoading: boolean;
  allRoles: WorkRole[];
  allDocumentTypes: DocumentType[];
  onUpdateTechnicianRoles: (technicianId: number | string, workRoleIds: (number | string)[]) => Promise<void>;
}

// --- Shared helpers / small presentational pieces. Pulling these out kills
// the four near-identical stat-card blocks and the status/score styling
// that used to be re-derived inline in the table row markup. ---

const GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-orange-500 to-amber-600",
];

function getGradient(id: number | string) {
  const charCodeSum = String(id).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[charCodeSum % GRADIENTS.length];
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "EHS Check Needed":
      return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    case "Suspended":
      return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
    case "On Leave":
    default:
      return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
  }
}

function scoreTone(score: number): "good" | "mid" | "low" {
  if (score >= 90) return "good";
  if (score >= 75) return "mid";
  return "low";
}

const SCORE_TEXT_CLASSES = {
  good: "text-[#18863A] dark:text-emerald-400",
  mid: "text-amber-600 dark:text-amber-400",
  low: "text-rose-600 dark:text-rose-400",
};

const SCORE_BAR_CLASSES = {
  good: "bg-[#18863A] dark:bg-emerald-500",
  mid: "bg-amber-500",
  low: "bg-rose-500",
};

function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold ${SCORE_TEXT_CLASSES[tone]}`}>{score}%</span>
      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${SCORE_BAR_CLASSES[tone]}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  valueColor: string;
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor, iconBorder, valueColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-50 dark:border-slate-800 shadow-xs flex items-center gap-3 sm:gap-4">
      <div className={`p-2.5 sm:p-3 rounded-xl border shrink-0 ${iconBg} ${iconColor} ${iconBorder}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider truncate">{label}</p>
        <h4 className={`text-lg sm:text-xl font-extrabold mt-0.5 ${valueColor}`}>{value}</h4>
      </div>
    </div>
  );
}

export const TechniciansView: React.FC<TechniciansViewProps> = ({
  user,
  filteredTechnicians,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  techsTotal,
  techSearch,
  setTechSearch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contractors,
  documents,
  onUpload,
  onAddTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  actionLoading,
  allRoles,
  allDocumentTypes,
  onUpdateTechnicianRoles,
}) => {
  // Client-side current time to avoid SSR hydration mismatches from new Date()
  const [currentTime] = useState(() => Date.now());

  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianProfile | null>(null);
  const [showAddTech, setShowAddTech] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter based on role
  const displayTechnicians = React.useMemo(() => {
    const list = filteredTechnicians || [];
    if (user?.role === Role.Technician) {
      return list.filter(t => t.userId === user.id);
    }
    if (statusFilter !== "All") {
      return list.filter(t => t.status === statusFilter);
    }
    return list;
  }, [filteredTechnicians, user, statusFilter]);

  // Reset page when filters change
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [techSearch, statusFilter]);

  const paginatedTechnicians = displayTechnicians.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const canAddTechnician = user?.role === Role.SafaricomAdmin ||
                         user?.role === Role.ContractorManager ||
                         user?.role === Role.ContractorEHSOfficer;

  // Compute dashboard metrics
  const stats = React.useMemo(() => {
    const total = displayTechnicians.length;
    const fullyCompliant = displayTechnicians.filter(t => t.overallEhsScore >= 90).length;
    const actionRequired = displayTechnicians.filter(t => t.status === "EHS Check Needed" || t.overallEhsScore < 75).length;
    const avgScore = total > 0
      ? Math.round(displayTechnicians.reduce((sum, t) => sum + t.overallEhsScore, 0) / total)
      : 0;

    return { total, fullyCompliant, actionRequired, avgScore };
  }, [displayTechnicians]);

  const statCards: StatCardProps[] = [
    {
      icon: Users,
      label: "Total Crew",
      value: stats.total,
      iconBg: "bg-slate-50 dark:bg-slate-800",
      iconColor: "text-slate-600 dark:text-slate-300",
      iconBorder: "border-slate-100 dark:border-slate-700",
      valueColor: "text-slate-900 dark:text-slate-100",
    },
    {
      icon: ShieldCheck,
      label: "Fully Compliant",
      value: stats.fullyCompliant,
      iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBorder: "border-emerald-100/50 dark:border-emerald-500/20",
      valueColor: "text-[#18863A] dark:text-emerald-400",
    },
    {
      icon: ShieldAlert,
      label: "At Risk / Review",
      value: stats.actionRequired,
      iconBg: "bg-rose-50 dark:bg-rose-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBorder: "border-rose-100 dark:border-rose-500/20",
      valueColor: "text-rose-600 dark:text-rose-400",
    },
    {
      icon: Activity,
      label: "Avg Safety Score",
      value: `${stats.avgScore}%`,
      iconBg: "bg-blue-50 dark:bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBorder: "border-blue-100/50 dark:border-blue-500/20",
      valueColor: "text-slate-800 dark:text-slate-100",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 sm:space-y-8 bg-slate-50/40 dark:bg-slate-950 custom-scrollbar max-w-[1600px] w-full mx-auto">
      {/* Title & Actions Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#18863A] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-[#18863A] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-100/50 dark:border-emerald-500/20">
              Contractor Personnel
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase italic mt-1.5">
            {user?.role === Role.Technician ? "My Safety Profile" : "Technician Crew"}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Manage safety certifications, compliance standings, and assign active field roles</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user?.role !== Role.Technician && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search technicians..."
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#18863A]/20 focus:border-[#18863A] transition-all outline-hidden shadow-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          )}
          {canAddTechnician && (
            <button
              onClick={() => setShowAddTech(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#18863A] text-white rounded-xl text-sm font-black hover:bg-[#156e2f] active:scale-95 transition-all shadow-md shadow-[#18863A]/10 cursor-pointer"
            >
              <Plus size={16} /> Register Technician
            </button>
          )}
        </div>
      </div>

      {/* Safety Statistics Summary Dashboard Banner */}
      {user?.role !== Role.Technician && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map(card => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Filter Chips & View Controls */}
      {user?.role !== Role.Technician && (
        <div className="flex items-center gap-2 pb-1 overflow-x-auto">
          <SlidersHorizontal size={14} className="text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
          {["All", "Active", "EHS Check Needed", "Suspended", "On Leave"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                statusFilter === tab
                  ? "bg-[#18863A] text-white border-[#18863A] shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Technicians List: a responsive card list rather than a table that
          needs a separate cramped mobile mode. */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedTechnicians.map(tech => {
            const techGrd = getGradient(tech.id);
            const statusStyle = getStatusStyle(tech.status);

            const techDocs = documents.filter(doc => doc.technicianId === tech.id);
            const expiredDocs = techDocs.filter(d => d.expiryDate && currentTime > 0 && new Date(d.expiryDate).getTime() < currentTime);
            const validDocsCount = techDocs.length - expiredDocs.length;

            return (
              <li
                key={tech.id}
                onClick={() => setSelectedTechnician(tech)}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group px-4 sm:px-6 py-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${techGrd} flex items-center justify-center text-white font-black text-base shadow-sm uppercase shrink-0`}>
                    {tech.name.substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#18863A] dark:group-hover:text-emerald-400 transition-colors truncate">
                      {tech.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{tech.specialization}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyle}`}>
                    {tech.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                  <ScoreBar score={tech.overallEhsScore} />
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                      <ShieldCheck size={14} className="text-emerald-500 dark:text-emerald-400" />
                      {validDocsCount}
                    </span>
                    {expiredDocs.length > 0 && (
                      <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400 ml-2">
                        <ShieldAlert size={14} />
                        {expiredDocs.length}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}

          {paginatedTechnicians.length === 0 && (
            <li className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              No technicians found matching your search.
            </li>
          )}
        </ul>

        <PaginationControls
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalItems={displayTechnicians.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* ADD TECHNICIAN MODAL OVERLAY */}
      {showAddTech && canAddTechnician && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[180] flex items-center justify-center p-4 overflow-y-auto modal-mobile-bottom">
          <div className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <AddTechnicianForm
              onAdd={async (tech) => {
                await onAddTechnician(tech);
                setShowAddTech(false);
              }}
              onClose={() => setShowAddTech(false)}
              actionLoading={actionLoading}
            />
          </div>
        </div>
      )}

      {/* TECHNICIAN DETAILS OVERLAY DRAWER SHEET */}
      {selectedTechnician && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[180] flex justify-end items-stretch p-0 md:p-4 overflow-hidden animate-in fade-in duration-200 panel-mobile-bottom">
          <div className="w-full md:max-w-2xl bg-white dark:bg-slate-900 h-full md:h-[calc(100vh-2rem)] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden lg:animate-in lg:slide-in-from-right lg:duration-300">
            <TechnicianDetails
              user={user}
              technician={selectedTechnician}
              documents={documents}
              onClose={() => setSelectedTechnician(null)}
              onUpload={onUpload}
              allRoles={allRoles}
              allDocumentTypes={allDocumentTypes}
              onUpdateRoles={onUpdateTechnicianRoles}
              onUpdateTechnician={onUpdateTechnician}
              onDeleteTechnician={onDeleteTechnician}
            />
          </div>
        </div>
      )}
    </div>
  );
};
