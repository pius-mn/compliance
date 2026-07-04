import React from "react";
import {
  X, Briefcase, Plus, Calendar, FileText, Camera, HardHat, ShieldCheck, Activity, Cpu, FileDown, LucideIcon
} from "lucide-react";
import { compressAndResizeImage } from "../utils/imageOptimizer";
import { generateProjectAuditReport } from "../utils/pdfGenerator";
import { Project, Milestone, User, Role, SitePhoto, TechnicianProfile, Contractor } from "../types";
import { MilestoneForm } from "./MilestoneForm";
import { MilestoneCard } from "./MilestoneCard";
import { DailyActivities } from "./DailyActivities";
import { SpecsSiteCrew } from "./SpecsSiteCrew";

export interface ProjectDetailsProps {
  project: Project | null;
  onClose: () => void;
  onEditProject?: (project: Project) => void;
  user: User | null;
  contractors: Contractor[];
  allMilestones: Milestone[];
  milestones: Milestone[];
  fetchMilestones: (id: string) => void;
  showAddMilestone: boolean;
  setShowAddMilestone: (show: boolean) => void;
  newMilestone: Record<string, unknown>;
  setNewMilestone: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  handleCreateMilestone: (e: React.FormEvent) => void;
  predefinedMilestones: string[];
  predefinedPrerequisites: string[];
  actionLoading: boolean;
  setUpdatingMilestone: (m: Milestone | null) => void;
  setUpdatingStatus: (s: Milestone["status"] | null) => void;
  setStatusComments: (c: string) => void;
  handleUpdateMilestoneStatus: (id: number, status: Milestone["status"], comments?: string) => void;
  handleUpdateMilestonePrerequisites: (id: number, cleared: string[]) => void;
  handleUpdateMilestoneClearedDependencies?: (id: number, cleared: number[]) => void;
  handleUpdateMilestoneDependencies?: (id: number, dependencies: number[]) => void;
  sitePhotos: SitePhoto[];
  deleteSitePhoto: (id: number) => void;
  projectPhotoInputRef?: React.RefObject<HTMLInputElement>;
  uploadSitePhoto?: (projectId: number, photoData: string, description: string) => Promise<void>;
  technicians: TechnicianProfile[];
  allUsers: User[];
  API_BASE: string;
  handleUpdateProjectTechnicians?: (projectId: number, assignedTechnicianIds: number[]) => Promise<void>;
  handleAssignProject?: (
    projectId: number,
    updates: {
      contractorId?: number | null;
      projectLeadId?: number | null;
      ehsOfficerId?: number | null;
    }
  ) => Promise<void>;
  handleDeleteProject?: (projectId: number | string) => Promise<void>;
}

interface CompressionMeta {
  originalSizeKB: number;
  compressedSizeKB: number;
  savingsPercent: number;
  width: number;
  height: number;
}

// ---- status badge styling, single source of truth for both header + tabs ----
const STATUS_BADGE_STYLES: Record<string, string> = {
  Planning: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  Pending: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "Not started": "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "Not Started": "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  "On Hold": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  Blocked: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  Delayed: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};
const STATUS_BADGE_DEFAULT = "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";

function getStatusBadgeStyles(status: string) {
  if (status.startsWith("Blocked")) return STATUS_BADGE_STYLES.Blocked;
  return STATUS_BADGE_STYLES[status] || STATUS_BADGE_DEFAULT;
}

// ---- parses the (possibly JSON-encoded) photo description blob ----
function parsePhotoDescription(rawDesc: unknown) {
  if (!rawDesc || typeof rawDesc !== "string") return { category: "General/Unassigned", milestoneId: "", text: "" };
  const trimmed = rawDesc.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawDesc);
      return {
        category: parsed.category || "General/Unassigned",
        milestoneId: parsed.milestoneId || "",
        text: parsed.text || "",
      };
    } catch {
      // Fallback
    }
  }
  return { category: "General/Unassigned", milestoneId: "", text: rawDesc };
}

// ---- shared metric card shell used by the 3 summary cards ----
function MetricCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4.5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs dark:shadow-none hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-200">
      {children}
    </div>
  );
}

function CardIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <div className={`p-2.5 rounded-lg ${className}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function TabButton({
  label,
  count,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer relative shrink-0 whitespace-nowrap ${
        isActive
          ? "border-red-600 text-slate-900 dark:text-white"
          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      }`}
    >
      <Icon className={`w-4 h-4 ${isActive ? "text-red-600" : "text-slate-400 dark:text-slate-500"}`} />
      <span>{label}</span>
      <span
        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-none ${
          isActive
            ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ArtifactUploadModal({
  fileName,
  isCompressing,
  compressionMeta,
  actionLoading,
  onCancel,
  onSave,
}: {
  fileName: string;
  isCompressing: boolean;
  compressionMeta: CompressionMeta | null;
  actionLoading: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const formatKB = (kb: number) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4 modal-mobile-bottom">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-xl dark:shadow-none animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload Site Artifact</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">File: {fileName}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="w-3 h-3 text-red-500" /> Image Optimizer
              </span>
              {isCompressing ? (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                  Optimizing...
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                  Ready
                </span>
              )}
            </div>
            {isCompressing ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Resizing and compressing photo in the browser to protect device memory limits...
              </p>
            ) : compressionMeta ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500 dark:text-slate-400">File Size:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {formatKB(compressionMeta.originalSizeKB)} {" ➔ "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatKB(compressionMeta.compressedSizeKB)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 dark:text-slate-500">Dimensions:</span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    Scaled to {compressionMeta.width} x {compressionMeta.height} px
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mt-1 flex">
                  <div
                    className="bg-slate-300 dark:bg-slate-600 h-full transition-all duration-500"
                    style={{ width: `${100 - compressionMeta.savingsPercent}%` }}
                  />
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${compressionMeta.savingsPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold text-right">
                  Saved {compressionMeta.savingsPercent}% of browser memory!
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Waiting for image pipeline optimization...
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionLoading || isCompressing}
              onClick={onSave}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {actionLoading ? "Uploading..." : isCompressing ? "Optimizing..." : "Save Artifact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: SitePhoto; onClose: () => void }) {
  const { category, text } = parsePhotoDescription(photo.description);
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xs z-[210] flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.photoData as string}
        alt="Site Evidence Lightbox"
        referrerPolicy="no-referrer"
        className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-white/10"
      />
      <div className="mt-4 text-center max-w-xl text-white space-y-1">
        <p className="text-sm font-medium">{text || "Site evidence photo"}</p>
        <div className="flex gap-4 justify-center items-center text-xs text-white/50">
          <span>Folder: {category}</span>
          <span>•</span>
          <span>By {photo.uploadedByUserName}</span>
          <span>•</span>
          <span>{new Date(photo.uploadDate).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  onClose,
  onEditProject,
  user,
  contractors,
  allMilestones,
  milestones,
  showAddMilestone,
  setShowAddMilestone,
  newMilestone,
  setNewMilestone,
  handleCreateMilestone,
  predefinedMilestones,
  predefinedPrerequisites,
  actionLoading,
  handleUpdateMilestoneStatus,
  handleUpdateMilestonePrerequisites,
  handleUpdateMilestoneClearedDependencies,
  handleUpdateMilestoneDependencies,
  sitePhotos,
  deleteSitePhoto,
  projectPhotoInputRef,
  uploadSitePhoto,
  technicians,
  allUsers,
  handleUpdateProjectTechnicians,
  handleAssignProject,
  handleDeleteProject
}) => {
  const localProjectPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const actualRef = projectPhotoInputRef || localProjectPhotoInputRef;
  const [expandedMilestoneId, setExpandedMilestoneId] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState<"milestones" | "evidence" | "specs">("milestones");
  const [lightboxPhoto, setLightboxPhoto] = React.useState<SitePhoto | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const canEditProject = user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomProjectCreator;

  const [prevProjectId, setPrevProjectId] = React.useState<number | undefined>(project?.id);
  if (project?.id !== prevProjectId) {
    setPrevProjectId(project?.id);
    setShowDeleteConfirm(false);
  }

  // Upload modal state
  const [showArtifactModal, setShowArtifactModal] = React.useState<boolean>(false);
  const [selectedFileBase64, setSelectedFileBase64] = React.useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = React.useState<string>("");
  const [compressionMeta, setCompressionMeta] = React.useState<CompressionMeta | null>(null);
  const [isCompressing, setIsCompressing] = React.useState<boolean>(false);

  const closeArtifactModal = () => {
    setShowArtifactModal(false);
    setSelectedFileBase64(null);
    setSelectedFileName("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      setSelectedFileBase64(base64Data);
      setSelectedFileName(file.name);
      setShowArtifactModal(true);
      setIsCompressing(true);
      setCompressionMeta(null);
      e.target.value = "";

      try {
        const result = await compressAndResizeImage(base64Data, 1000, 1000, 0.75);
        setSelectedFileBase64(result.compressedBase64);
        setCompressionMeta(result);
      } catch (err) {
        console.error("Error optimizing image:", err);
      } finally {
        setIsCompressing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveArtifact = async () => {
    if (uploadSitePhoto && selectedFileBase64 && project) {
      await uploadSitePhoto(project.id, selectedFileBase64, JSON.stringify({}));
    }
    closeArtifactModal();
  };

  if (!project) return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full bg-slate-50/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-12 text-center space-y-4">
      <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-xl shadow-xs dark:shadow-none flex items-center justify-center text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-800">
        <Briefcase className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Active Site Selected</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] leading-normal mx-auto">
          Select a project site from the registry on the left to inspect its active rollout pipeline, safety compliance, and team assignments.
        </p>
      </div>
    </div>
  );

  const projectContractor = (contractors || []).find(b => b && b.id === project.contractorId);
  const projectMilestones = (allMilestones || []).filter(m => m && m.projectId === project.id);
  const completedM = projectMilestones.filter(m => m && m.status === "Completed").length;
  const totalM = projectMilestones.length;
  const completionPct = Math.min(100, Math.round((completedM / 12) * 100));
  const progressOutOf12 = completedM;

  const currentMilestone =
    projectMilestones.find(m => m && m.status === "In Progress") ||
    projectMilestones.find(m => m && m.status === "Blocked") ||
    projectMilestones.find(m => m && m.status === "Pending") ||
    (projectMilestones.length === 0
      ? null
      : projectMilestones.every(m => m && m.status === "Completed")
        ? projectMilestones[projectMilestones.length - 1]
        : projectMilestones[0]);

  const currentMilestoneTitle = currentMilestone ? currentMilestone.title : "Site Specifications & Oversight";
  const currentMilestoneStatus = currentMilestone ? currentMilestone.status : "Not Started";

  const canUpdateMilestones = !!(user?.role === Role.SafaricomAdmin ||
    user?.role === Role.SafaricomEHSOfficer ||
    user?.role === Role.ContractorManager ||
    user?.role === Role.ContractorEHSOfficer ||
    (user?.isCentral && user?.role !== Role.Technician));

  const canAddMilestone = user?.role === Role.ContractorManager || user?.role === Role.ContractorEHSOfficer;

  const tabs = [
    { id: "milestones" as const, label: "Operational Gateways", count: milestones.length, icon: Calendar },
    { id: "evidence" as const, label: "Daily Activities", count: (sitePhotos || []).filter(ph => ph && ph.projectId === project.id).length, icon: Camera },
    { id: "specs" as const, label: "Specs & Site Crew", count: (project.assignedTechnicianIds || []).length, icon: HardHat },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50/10 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs dark:shadow-none">

      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div className="flex items-start gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Go Back to Site Registry"
          >
            <span>← Back to Registry</span>
          </button>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded">
                {projectContractor?.name || "Unassigned"}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getStatusBadgeStyles(currentMilestoneStatus)}`}>
                {currentMilestoneStatus}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Current Gate: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentMilestoneTitle}</span>
            </p>
          </div>
        </div>

        {/* Actions Header */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => generateProjectAuditReport(project, projectMilestones, technicians, contractors || [])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-xs dark:shadow-none transition-all cursor-pointer"
            id="export_project_pdf_report_btn"
          >
            <FileDown className="w-3.5 h-3.5 text-red-500 animate-bounce" />
            Export PDF Report
          </button>
          {canAddMilestone && (
            <button
              onClick={() => setShowAddMilestone(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs dark:shadow-none transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Milestone
            </button>
          )}
          {canEditProject && (
            showDeleteConfirm ? (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 p-1 rounded-lg border border-rose-100 dark:border-rose-500/20">
                <button
                  onClick={async () => {
                    if (handleDeleteProject) {
                      await handleDeleteProject(project.id);
                      setShowDeleteConfirm(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-all whitespace-nowrap"
                >
                  {actionLoading ? "Deleting..." : "Confirm Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={actionLoading}
                  className="px-2 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onEditProject?.(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Delete
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Hidden file input for Daily Activities photo uploads */}
      <input type="file" ref={actualRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {/* DETAILED CONTENT CONTAINER */}
      <div className="flex-1 p-5 md:p-6 space-y-6">

        {/* METRICS & SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCardShell>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">EHS Compliance</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">98.4%</div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Overall HSE compliance score</p>
              </div>
              <CardIcon icon={ShieldCheck} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
            </div>
          </MetricCardShell>

          <MetricCardShell>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rollout Index</span>
              <span className="text-[9px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-full">
                {completionPct}%
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                {progressOutOf12} <span className="text-sm text-slate-400 dark:text-slate-500 font-normal">/ 12</span>
              </div>
              <CardIcon icon={Activity} className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2" />
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-red-600 h-full rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
            </div>
          </MetricCardShell>

          <MetricCardShell>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Operational Gates</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {completedM} <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">Approved</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{totalM} total project phases logged</p>
              </div>
              <CardIcon icon={Briefcase} className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
            </div>
          </MetricCardShell>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="flex overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 border-b border-slate-200 dark:border-slate-800 pb-px gap-4 sm:gap-6 shrink-0">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              count={tab.count}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* TAB CONTENT: OPERATIONAL GATEWAYS (MILESTONES) */}
        {activeTab === "milestones" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Statement of Work Brief */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 p-4 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">Statement of Work Brief</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {project.description || "No official scope of work details loaded for this registered deployment."}
                </p>
              </div>
            </div>

            {/* Timeline Cards List */}
            <div className="space-y-4">
              {milestones.length === 0 ? (
                <div className="p-10 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <Calendar className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No Milestones Initialized</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Please configure milestones for this tower site registry.</p>
                </div>
              ) : (
                milestones.map((m) => (
                  <MilestoneCard
                    key={m.id}
                    milestone={m}
                    isExpanded={expandedMilestoneId === m.id}
                    onToggleExpand={() => setExpandedMilestoneId(expandedMilestoneId === m.id ? null : m.id)}
                    isActiveGate={currentMilestone?.id === (m.id as number)}
                    canUpdateMilestones={canUpdateMilestones}
                    handleUpdateMilestonePrerequisites={handleUpdateMilestonePrerequisites}
                    handleUpdateMilestoneClearedDependencies={handleUpdateMilestoneClearedDependencies}
                    handleUpdateMilestoneDependencies={handleUpdateMilestoneDependencies}
                    handleUpdateMilestoneStatus={handleUpdateMilestoneStatus}
                    allMilestones={allMilestones}
                    milestones={milestones}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: DAILY ACTIVITIES */}
        {activeTab === "evidence" && (
          <DailyActivities
            project={project}
            user={user}
            sitePhotos={sitePhotos}
            deleteSitePhoto={deleteSitePhoto}
            setLightboxPhoto={setLightboxPhoto}
            actualRef={actualRef}
            handleFileChange={handleFileChange}
          />
        )}

        {/* TAB CONTENT: SPECS & SITE CREW */}
        {activeTab === "specs" && (
          <SpecsSiteCrew
            project={project}
            user={user}
            contractors={contractors}
            allUsers={allUsers}
            technicians={technicians}
            handleUpdateProjectTechnicians={handleUpdateProjectTechnicians}
            handleAssignProject={handleAssignProject}
          />
        )}

      </div>

      {/* PHOTO METADATA UPLOAD MODAL */}
      {showArtifactModal && selectedFileBase64 && (
        <ArtifactUploadModal
          fileName={selectedFileName}
          isCompressing={isCompressing}
          compressionMeta={compressionMeta}
          actionLoading={actionLoading}
          onCancel={closeArtifactModal}
          onSave={handleSaveArtifact}
        />
      )}

      {/* PHOTO LIGHTBOX DIALOG */}
      {lightboxPhoto && <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}

      {/* Milestone Add Form Drawer Overlay */}
      <MilestoneForm
        show={showAddMilestone}
        onClose={() => setShowAddMilestone(false)}
        newMilestone={newMilestone}
        setNewMilestone={setNewMilestone}
        handleCreateMilestone={handleCreateMilestone}
        actionLoading={actionLoading}
        predefinedMilestones={predefinedMilestones}
        predefinedPrerequisites={predefinedPrerequisites}
        projectId={project.id}
        projectName={project.name}
        milestonesCount={milestones.length}
      />

      {/* Floating Add Action Trigger on Mobile */}
      <div className="lg:hidden fixed bottom-24 right-6 z-[170]">
        {canAddMilestone && (
          <button
            onClick={() => setShowAddMilestone(true)}
            className="w-12 h-12 bg-red-600 active:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Create Milestone"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

    </div>
  );
};
