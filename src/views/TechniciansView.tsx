import React, { useState, useCallback, useMemo } from "react";
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
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
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

const STATUS_TABS = ["All", "Active", "EHS Check Needed", "Suspended", "On Leave"] as const;

const ITEMS_PER_PAGE = 10;

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

const ScoreBar = React.memo(function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-2">
      <span className={`font-bold ${SCORE_TEXT_CLASSES[tone]}`}>{score}%</span>
      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${SCORE_BAR_CLASSES[tone]}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
});

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  valueColor: string;
}

const StatCard = React.memo(function StatCard({ icon: Icon, label, value, iconBg, iconColor, iconBorder, valueColor }: StatCardProps) {
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
});

// --- Generic modal overlay. The add/edit/delete/details overlays previously
// each hand-rolled the same fixed-inset backdrop + stopPropagation wrapper;
// consolidating them here removes ~20 duplicated lines and one shared source
// of truth for z-index/backdrop styling. ---

interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "right";
  maxWidth?: string;
  zIndex?: number;
}

function ModalOverlay({ onClose, children, align = "center", maxWidth = "max-w-lg", zIndex = 180 }: ModalOverlayProps) {
  const isRight = align === "right";
  return (
    <div
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex p-0 md:p-4 overflow-hidden animate-in fade-in duration-200 ${
        isRight ? "justify-end items-stretch panel-mobile-bottom" : `items-center justify-center overflow-y-auto p-4 modal-mobile-bottom`
      }`}
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} ${
          isRight
            ? "bg-white dark:bg-slate-900 h-full md:h-[calc(100vh-2rem)] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden lg:animate-in lg:slide-in-from-right lg:duration-300"
            : "shadow-2xl animate-in zoom-in-95 duration-300"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// --- Doc counts (valid/expired) per technician, keyed once instead of being
// derived with a fresh Array#filter over the whole documents list for every
// row on every render (was O(technicians * documents), now O(documents)). ---

function useTechnicianDocStats(documents: TechnicianDocument[], currentTime: number) {
  return useMemo(() => {
    const map = new Map<number | string, { valid: number; expired: number }>();
    for (const doc of documents) {
      const entry = map.get(doc.technicianId) || { valid: 0, expired: 0 };
      const isExpired = !!doc.expiryDate && currentTime > 0 && new Date(doc.expiryDate).getTime() < currentTime;
      if (isExpired) entry.expired += 1;
      else entry.valid += 1;
      map.set(doc.technicianId, entry);
    }
    return map;
  }, [documents, currentTime]);
}

// --- Single technician row, memoized. Without this, clicking any row (e.g.
// to open the details drawer) re-renders every other row in the list too. ---

interface TechnicianRowProps {
  tech: TechnicianProfile;
  docStats: { valid: number; expired: number };
  canManageTechnician: boolean;
  onView: (tech: TechnicianProfile) => void;
  onEdit: (tech: TechnicianProfile) => void;
  onDeleteRequest: (id: number | string) => void;
}

const TechnicianRow = React.memo(function TechnicianRow({
  tech,
  docStats,
  canManageTechnician,
  onView,
  onEdit,
  onDeleteRequest,
}: TechnicianRowProps) {
  const techGrd = getGradient(tech.id);
  const statusStyle = getStatusStyle(tech.status);
  const { valid: validDocsCount, expired: expiredCount } = docStats;

  return (
    <li
      onClick={() => onView(tech)}
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
          {expiredCount > 0 && (
            <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400 ml-2">
              <ShieldAlert size={14} />
              {expiredCount}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onView(tech); }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
        >
          <Eye size={13} /> View
        </button>
        {canManageTechnician && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(tech); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#18863A] dark:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-95 transition-all cursor-pointer"
          >
            <Edit size={13} /> Edit
          </button>
        )}
        {canManageTechnician && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(tech.id); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </li>
  );
});

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
  const [editTechnician, setEditTechnician] = useState<TechnicianProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter based on role
  const displayTechnicians = useMemo(() => {
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

  const paginatedTechnicians = useMemo(
    () => displayTechnicians.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [displayTechnicians, currentPage]
  );

  // One pass over `documents` instead of one filter-scan per rendered row.
  const docStatsByTechnician = useTechnicianDocStats(documents, currentTime);

  const canAddTechnician = user?.role === Role.SafaricomAdmin ||
                         user?.role === Role.ContractorManager ||
                         user?.role === Role.ContractorEHSOfficer;

  const canManageTechnician = user?.role === Role.ContractorManager ||
                             user?.role === Role.ContractorEHSOfficer;

  // Compute dashboard metrics
  const stats = useMemo(() => {
    const total = displayTechnicians.length;
    const fullyCompliant = displayTechnicians.filter(t => t.overallEhsScore >= 90).length;
    const actionRequired = displayTechnicians.filter(t => t.status === "EHS Check Needed" || t.overallEhsScore < 75).length;
    const avgScore = total > 0
      ? Math.round(displayTechnicians.reduce((sum, t) => sum + t.overallEhsScore, 0) / total)
      : 0;

    return { total, fullyCompliant, actionRequired, avgScore };
  }, [displayTechnicians]);

  const statCards: StatCardProps[] = useMemo(() => [
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
  ], [stats]);

  // Stable callbacks so TechnicianRow's React.memo actually skips re-renders.
  const handleView = useCallback((tech: TechnicianProfile) => setSelectedTechnician(tech), []);
  const handleEdit = useCallback((tech: TechnicianProfile) => setEditTechnician(tech), []);
  const handleDeleteRequest = useCallback((id: number | string) => setDeleteConfirmId(id), []);

  const techToDelete = useMemo(
    () => (deleteConfirmId !== null ? paginatedTechnicians.find(t => t.id === deleteConfirmId) : undefined),
    [deleteConfirmId, paginatedTechnicians]
  );

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
          {STATUS_TABS.map((tab) => (
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
          {paginatedTechnicians.map(tech => (
            <TechnicianRow
              key={tech.id}
              tech={tech}
              docStats={docStatsByTechnician.get(tech.id) || { valid: 0, expired: 0 }}
              canManageTechnician={canManageTechnician}
              onView={handleView}
              onEdit={handleEdit}
              onDeleteRequest={handleDeleteRequest}
            />
          ))}

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
        <ModalOverlay onClose={() => setShowAddTech(false)}>
          <AddTechnicianForm
            onAdd={async (tech) => {
              await onAddTechnician(tech);
              setShowAddTech(false);
            }}
            onClose={() => setShowAddTech(false)}
            actionLoading={actionLoading}
          />
        </ModalOverlay>
      )}

      {/* EDIT TECHNICIAN MODAL OVERLAY */}
      {editTechnician && canManageTechnician && (
        <ModalOverlay onClose={() => setEditTechnician(null)}>
          <AddTechnicianForm
            editId={editTechnician.id}
            initialData={{
              name: editTechnician.name,
              phone: editTechnician.phone,
              specialization: editTechnician.specialization,
            }}
            onUpdate={async (_, tech) => {
              await onUpdateTechnician(editTechnician.id, tech);
              setEditTechnician(null);
            }}
            onClose={() => setEditTechnician(null)}
            actionLoading={actionLoading}
          />
        </ModalOverlay>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId !== null && canManageTechnician && (
        <ModalOverlay onClose={() => setDeleteConfirmId(null)} maxWidth="max-w-sm" zIndex={200}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 mb-4">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">Delete Technician</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{techToDelete?.name || "this technician"}</span>?
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                This action cannot be undone. The technician and all associated user data will be permanently removed.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirmId !== null) {
                    await onDeleteTechnician(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-600/10 flex items-center justify-center gap-2"
              >
                {actionLoading ? "Deleting..." : <><Trash2 size={15} /> Delete</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* TECHNICIAN DETAILS OVERLAY DRAWER SHEET */}
      {selectedTechnician && (
        <ModalOverlay onClose={() => setSelectedTechnician(null)} align="right" maxWidth="md:max-w-2xl">
          <TechnicianDetails
            user={user}
            technician={selectedTechnician}
            documents={documents}
            onClose={() => setSelectedTechnician(null)}
            onUpload={onUpload}
            allRoles={allRoles}
            allDocumentTypes={allDocumentTypes}
            onUpdateRoles={onUpdateTechnicianRoles}
          />
        </ModalOverlay>
      )}
    </div>
  );
};
