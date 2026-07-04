import React from "react";
import { 
  X, Briefcase, Plus, Calendar, FileText, Camera, HardHat, ShieldCheck, Activity, Cpu, FileDown
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
  const [compressionMeta, setCompressionMeta] = React.useState<{
    originalSizeKB: number;
    compressedSizeKB: number;
    savingsPercent: number;
    width: number;
    height: number;
  } | null>(null);
  const [isCompressing, setIsCompressing] = React.useState<boolean>(false);



  // Parser helper
  const parsePhotoDescription = (rawDesc: unknown) => {
    if (!rawDesc || typeof rawDesc !== "string") return { category: "General/Unassigned", milestoneId: "", text: "" };
    const trimmed = rawDesc.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawDesc);
        return {
          category: parsed.category || "General/Unassigned",
          milestoneId: parsed.milestoneId || "",
          text: parsed.text || ""
        };
      } catch {
        // Fallback
      }
    }
    return {
      category: "General/Unassigned",
      milestoneId: "",
      text: rawDesc
    };
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

  if (!project) return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full bg-slate-50/40 rounded-2xl border border-slate-200/60 p-12 text-center space-y-4">
      <div className="w-16 h-16 bg-white rounded-xl shadow-xs flex items-center justify-center text-slate-300 border border-slate-100">
        <Briefcase className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-slate-800">No Active Site Selected</h3>
        <p className="text-xs text-slate-400 max-w-[280px] leading-normal mx-auto">
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

  const currentMilestone = (() => {
    if (!projectMilestones || projectMilestones.length === 0) {
      return null;
    }
    const inProgress = projectMilestones.find(m => m && m.status === "In Progress");
    if (inProgress) return inProgress;

    const blocked = projectMilestones.find(m => m && m.status === "Blocked");
    if (blocked) return blocked;

    const firstPending = projectMilestones.find(m => m && m.status === "Pending");
    if (firstPending) return firstPending;

    if (projectMilestones.every(m => m && m.status === "Completed")) {
      return projectMilestones[projectMilestones.length - 1];
    }

    return projectMilestones[0];
  })();

  const currentMilestoneTitle = currentMilestone ? currentMilestone.title : "Site Specifications & Oversight";
  const currentMilestoneStatus = currentMilestone ? currentMilestone.status : "Not Started";

  const getStatusBadgeStyles = (status: string) => {
    if (status.startsWith("Blocked")) {
      return "bg-red-50 text-red-700 border-red-100";
    }
    switch (status) {
      case "Planning":
      case "Pending":
      case "Not started":
      case "Not Started":
        return "bg-slate-50 text-slate-600 border-slate-200";
      case "In Progress":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "On Hold":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Blocked":
      case "Delayed":
        return "bg-red-50 text-red-700 border-red-100";
      default:
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
    }
  };

  const canUpdateMilestones = !!(user?.role === Role.SafaricomAdmin || 
    user?.role === Role.SafaricomEHSOfficer || 
    user?.role === Role.ContractorManager ||
    user?.role === Role.ContractorEHSOfficer ||
    (user?.isCentral && user?.role !== Role.Technician));

  return (
    <div className="flex-1 flex flex-col bg-slate-50/10 border border-slate-200 rounded-xl shadow-xs">
      
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div className="flex items-start gap-3">
          <button 
            onClick={onClose} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Go Back to Site Registry"
          >
            <span>← Back to Registry</span>
          </button>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                {projectContractor?.name || "Unassigned"}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getStatusBadgeStyles(currentMilestoneStatus)}`}>
                {currentMilestoneStatus}
              </span>
            </div>
            <>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {project.name}
              </h2>
              <p className="text-xs text-slate-500">
                Current Gate: <span className="font-semibold text-slate-700">{currentMilestoneTitle}</span>
              </p>
            </>
          </div>
        </div>
        
        {/* Actions Header */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => generateProjectAuditReport(
              project,
              projectMilestones,
              technicians,
              contractors || []
            )}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            id="export_project_pdf_report_btn"
          >
            <FileDown className="w-3.5 h-3.5 text-red-500 animate-bounce" />
            Export PDF Report
          </button>
          {(user?.role === Role.ContractorManager || user?.role === Role.ContractorEHSOfficer) && (
            <button
              onClick={() => setShowAddMilestone(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Milestone
            </button>
          )}
          {canEditProject && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-100">
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
                    className="px-2 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg text-xs transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (onEditProject) onEditProject(project);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden file input for Daily Activities photo uploads */}
      <input
        type="file"
        ref={actualRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* DETAILED CONTENT CONTAINER */}
      <div className="flex-1 p-5 md:p-6 space-y-6">
        
        {/* METRICS & SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4.5 rounded-xl border border-slate-200/60 shadow-xs flex items-center justify-between hover:border-red-200 hover:shadow-xs transition-all duration-200">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">EHS Compliance</span>
              <div className="text-2xl font-black text-slate-900 leading-none">98.4%</div>
              <p className="text-[10px] text-slate-500 font-medium">Overall HSE compliance score</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          
          <div className="bg-white p-4.5 rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-between hover:border-red-200 hover:shadow-xs transition-all duration-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Rollout Index</span>
              <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                {completionPct}%
              </span>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-black text-slate-900 leading-none">
                {progressOutOf12} <span className="text-sm text-slate-400 font-normal">/ 12</span>
              </div>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-red-600 h-full rounded-full transition-all duration-700" 
                style={{ width: `${completionPct}%` }} 
              />
            </div>
          </div>

          <div className="bg-white p-4.5 rounded-xl border border-slate-200/60 shadow-xs flex items-center justify-between hover:border-red-200 hover:shadow-xs transition-all duration-200">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Operational Gates</span>
              <div className="text-2xl font-black text-slate-900 leading-none">
                {completedM} <span className="text-sm text-slate-400 font-medium">Approved</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">{totalM} total project phases logged</p>
            </div>
            <div className="p-2.5 bg-slate-50 text-slate-500 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION BAR */}
        <div className="flex border-b border-slate-200 pb-px gap-6 shrink-0">
          {[
            { id: "milestones", label: "Operational Gateways", count: milestones.length, icon: Calendar },
            { id: "evidence", label: "Daily Activities", count: (sitePhotos || []).filter(ph => ph && ph.projectId === project.id).length, icon: Camera },
            { id: "specs", label: "Specs & Site Crew", count: (project.assignedTechnicianIds || []).length, icon: HardHat }
          ].map((tab) => {
            const IsActive = activeTab === (tab.id as string);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "milestones" | "evidence" | "specs")}
                className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer relative ${
                  IsActive 
                    ? "border-red-600 text-slate-900" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className={`w-4 h-4 ${IsActive ? "text-red-600" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-none ${
                  IsActive ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENT: OPERATIONAL GATEWAYS (MILESTONES) */}
        {activeTab === "milestones" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Statement of Work Brief */}
            <div className="bg-slate-50 border border-slate-200/85 p-4 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-lg text-red-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Statement of Work Brief</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {project.description || "No official scope of work details loaded for this registered deployment."}
                </p>
              </div>
            </div>

            {/* Timeline Cards List */}
            <div className="space-y-4">
              {milestones.length === 0 ? (
                <div className="p-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-center">
                  <Calendar className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-500">No Milestones Initialized</p>
                  <p className="text-[11px] text-slate-400 mt-1">Please configure milestones for this tower site registry.</p>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4 modal-mobile-bottom">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upload Site Artifact</h3>
                  <p className="text-xs text-slate-400">File: {selectedFileName}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowArtifactModal(false);
                    setSelectedFileBase64(null);
                    setSelectedFileName("");
                  }} 
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">


                {/* Client-side Image Optimization Status Info Panel */}
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-red-500" /> Image Optimizer
                    </span>
                    {isCompressing ? (
                      <span className="text-[10px] text-amber-600 font-semibold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                        Optimizing...
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                        Ready
                      </span>
                    )}
                  </div>
                  {isCompressing ? (
                    <p className="text-[10px] text-slate-500">Resizing and compressing photo in the browser to protect device memory limits...</p>
                  ) : compressionMeta ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">File Size:</span>
                        <span className="text-slate-800">
                          {compressionMeta.originalSizeKB > 1024 
                            ? `${(compressionMeta.originalSizeKB / 1024).toFixed(1)} MB` 
                            : `${compressionMeta.originalSizeKB} KB`} 
                          {" ➔ "} 
                          <span className="text-emerald-600 font-bold">
                            {compressionMeta.compressedSizeKB > 1024 
                              ? `${(compressionMeta.compressedSizeKB / 1024).toFixed(1)} MB` 
                              : `${compressionMeta.compressedSizeKB} KB`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Dimensions:</span>
                        <span className="text-slate-500 font-mono">
                          Scaled to {compressionMeta.width} x {compressionMeta.height} px
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-1 flex">
                        <div 
                          className="bg-slate-300 h-full transition-all duration-500" 
                          style={{ width: `${100 - compressionMeta.savingsPercent}%` }}
                        />
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${compressionMeta.savingsPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-emerald-600 font-semibold text-right">
                        Saved {compressionMeta.savingsPercent}% of browser memory!
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium">Waiting for image pipeline optimization...</p>
                  )}
                </div>


              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowArtifactModal(false);
                    setSelectedFileBase64(null);
                    setSelectedFileName("");
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || isCompressing}
                  onClick={async () => {
                    if (uploadSitePhoto && selectedFileBase64) {
                      await uploadSitePhoto(project.id, selectedFileBase64, JSON.stringify({}));
                    }
                    setShowArtifactModal(false);
                    setSelectedFileBase64(null);
                    setSelectedFileName("");
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Uploading..." : isCompressing ? "Optimizing..." : "Save Artifact"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX DIALOG */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xs z-[210] flex flex-col items-center justify-center p-4">
          <button 
            onClick={() => setLightboxPhoto(null)} 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={lightboxPhoto.photoData as string} 
            alt="Site Evidence Lightbox" 
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-white/10" 
          />
          <div className="mt-4 text-center max-w-xl text-white space-y-1">
            <p className="text-sm font-medium">{parsePhotoDescription(lightboxPhoto.description).text || "Site evidence photo"}</p>
            <div className="flex gap-4 justify-center items-center text-xs text-white/50">
              <span>Folder: {parsePhotoDescription(lightboxPhoto.description).category}</span>
              <span>•</span>
              <span>By {lightboxPhoto.uploadedByUserName}</span>
              <span>•</span>
              <span>{new Date(lightboxPhoto.uploadDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

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
        {(user?.role === Role.ContractorManager || user?.role === Role.ContractorEHSOfficer) && (
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
