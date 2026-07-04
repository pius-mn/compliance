import React from "react";
import { Plus } from "lucide-react";
import { ProjectList } from "../components/ProjectList";
import { ProjectDetails, type ProjectDetailsProps } from "../components/ProjectDetails";
import { User, Project, Milestone, SitePhoto, TechnicianProfile, Role, Contractor } from "../types";

export interface ProjectsViewProps {
  user: User | null;
  projectSearch: string;
  setProjectSearch: React.Dispatch<React.SetStateAction<string>>;
  setProjectPage: React.Dispatch<React.SetStateAction<number>>;
  showAddProject: boolean;
  setShowAddProject: React.Dispatch<React.SetStateAction<boolean>>;
  handleCreateProject: (e: React.FormEvent) => void;
  handleUpdateProject: (projectId: number | string, updates: Record<string, unknown>) => Promise<void>;
  newProject: Record<string, unknown>;
  setNewProject: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  contractors: Contractor[];
  selectedProjectId: number | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<number | null>>;
  projectPhotoInputRef?: React.RefObject<HTMLInputElement>;
  handleFileChangeProjectPhotos?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadSitePhoto?: (projectId: number, photoData: string, description: string) => Promise<void>;
  sitePhotos: SitePhoto[];
  deleteSitePhoto: (id: number) => void;
  paginatedProjects: Project[];
  filteredProjects: Project[];
  allMilestones: Milestone[];
  projects: Project[];
  fetchMilestones: (projectId: number) => void;
  allUsers: User[];
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
  projectPage: number;
  milestones: Milestone[];
  showAddMilestone: boolean;
  setShowAddMilestone: React.Dispatch<React.SetStateAction<boolean>>;
  setNewMilestone: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  newMilestone: Record<string, unknown>;
  handleCreateMilestone: (e: React.FormEvent) => void;
  predefinedMilestones: string[];
  predefinedPrerequisites: string[];
  actionLoading: boolean;
  setUpdatingMilestone: React.Dispatch<React.SetStateAction<Milestone | null>>;
  setUpdatingStatus: React.Dispatch<React.SetStateAction<Milestone["status"] | null>>;
  setStatusComments: React.Dispatch<React.SetStateAction<string>>;
  handleUpdateMilestoneStatus: (id: number, status: Milestone["status"], comments?: string) => void;
  handleUpdateMilestonePrerequisites: (id: number, cleared: string[]) => void;
  handleUpdateMilestoneClearedDependencies?: (id: number, cleared: number[]) => void;
  handleUpdateMilestoneDependencies?: (id: number, dependencies: number[]) => Promise<void>;
  technicians: TechnicianProfile[];
  API_BASE: string;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", msg: string) => void;
  handleUpdateProjectTechnicians?: (projectId: number, assignedTechnicianIds: number[]) => Promise<void>;
  handleAssignProject?: (
    projectId: number,
    updates: {
      contractorId?: number | null;
      projectLeadId?: number | null;
      ehsOfficerId?: number | null;
    }
  ) => Promise<void>;
  handleExportProjects?: () => void;
}

export default function ProjectsView(props: ProjectsViewProps) {
  const {
    user,
    projectSearch,
    setProjectSearch,
    projectPage,
    setProjectPage,
    itemsPerPage,
    setItemsPerPage,
    filteredProjects,
    selectedProjectId,
    setSelectedProjectId,
    contractors,
    allMilestones,
    showAddProject,
    setShowAddProject,
    handleCreateProject,
    handleUpdateProject,
    newProject,
    setNewProject,
    actionLoading,
    projects,
  } = props;

  const [editingProject, setEditingProject] = React.useState<Project | null>(null);

  const isTechnician = user?.role === Role.Technician;

  const displayProjects = React.useMemo(() => {
    const projects = filteredProjects || props.projects || [];
    if (isTechnician) {
      return projects.filter(p => p.assignedTechnicianIds?.includes(user.id));
    }
    return projects;
  }, [filteredProjects, props.projects, isTechnician, user]);

  const paginatedDisplayProjects = React.useMemo(() => {
    const start = (projectPage - 1) * itemsPerPage;
    return displayProjects.slice(start, start + itemsPerPage);
  }, [displayProjects, projectPage, itemsPerPage]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  return (
    <div className="flex-1 flex flex-col space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
      {/* Clean & Elegant Header */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div className="flex flex-col space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isTechnician ? "My Assignments" : "Site Deployment Registry"}
          </h2>
          <p className="text-xs text-slate-500">
            {isTechnician ? "Track your assigned network sites, checklists, and milestones" : "Monitor deployment pipelines, contractor performance, and safety clearances"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedProjectId === null ? (
          <div className="flex-1 flex flex-col">
            <ProjectList 
              projectSearch={projectSearch}
              setProjectSearch={setProjectSearch}
              projectPage={projectPage}
              setProjectPage={setProjectPage}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              filteredProjects={displayProjects}
              paginatedProjects={paginatedDisplayProjects}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={(id: number | null) => {
                setSelectedProjectId(id);
                if (id) props.fetchMilestones(id);
              }}
              contractors={contractors}
              allMilestones={allMilestones}
              onAddProject={() => setShowAddProject(true)}
              showAddButton={user?.role === Role.SafaricomAdmin || user?.role === Role.SafaricomProjectCreator}
              handleExportProjects={props.handleExportProjects}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col animate-in fade-in duration-200">
            <ProjectDetails 
              {...(props as unknown as ProjectDetailsProps)}
              project={selectedProject}
              onClose={() => setSelectedProjectId(null)}
              onEditProject={(p) => {
                setEditingProject(p);
                setNewProject({
                  name: p.name,
                  description: p.description || "",
                  contractorId: String(p.contractorId ?? ""),
                  startDate: p.startDate || new Date().toISOString().split("T")[0],
                  endDate: p.endDate || "2026-12-31",
                  budget: String(p.budget ?? ""),
                  rolloutDistance: String(p.rolloutDistance ?? ""),
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Reusable Create/Edit Project Modal Overlay */}
      {(showAddProject || editingProject) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4 sm:p-4 modal-mobile-bottom">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <form
              onSubmit={async (e) => {
                if (editingProject) {
                  e.preventDefault();
                  await handleUpdateProject(editingProject.id, {
                    name: newProject.name,
                    description: newProject.description,
                    contractorId: editingProject.contractorId,
                    startDate: newProject.startDate,
                    endDate: newProject.endDate,
                    budget: Number(newProject.budget) || 0,
                    rolloutDistance: parseFloat(newProject.rolloutDistance as string) || 0,
                  });
                  setEditingProject(null);
                  setShowAddProject(false);
                  setNewProject({
                    name: "",
                    description: "",
                    contractorId: "",
                    startDate: new Date().toISOString().split("T")[0],
                    endDate: "2026-12-31",
                    budget: "",
                    rolloutDistance: ""
                  });
                } else {
                  await handleCreateProject(e);
                }
              }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingProject ? "Edit Site" : "Initialize New Site"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingProject ? "Update the site deployment details" : "Deploy a new site monitoring and EHS gateway"}
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingProject(null);
                    setShowAddProject(false);
                    setNewProject({
                      name: "",
                      description: "",
                      contractorId: "",
                      startDate: new Date().toISOString().split("T")[0],
                      endDate: "2026-12-31",
                      budget: "",
                      rolloutDistance: ""
                    });
                  }} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Site Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Kisumu East LTE Base"
                      value={newProject.name as string}
                      onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                      required
                    />
                  </div>

                  {user?.role === Role.SafaricomProjectCreator ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Partner Contractor</label>
                      <div className="px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 italic">
                        {editingProject ? "Contractor assignment managed by Assigner/Admin" : "Contractor assignment managed by Assigner/Admin"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Partner Contractor</label>
                      <select
                        value={newProject.contractorId as string}
                        onChange={(e) => setNewProject({...newProject, contractorId: e.target.value})}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer"
                        required
                        disabled={!!editingProject}
                      >
                        <option value="unassigned">Select Partner...</option>
                        {contractors.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Deployment Start</label>
                    <input
                      type="date"
                      value={newProject.startDate as string}
                      onChange={(e) => setNewProject({...newProject, startDate: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Estimated Completion</label>
                    <input
                      type="date"
                      value={newProject.endDate as string}
                      onChange={(e) => setNewProject({...newProject, endDate: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Project Budget (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 150000"
                      value={newProject.budget as string}
                      onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Rollout Distance (KM)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 12.5"
                      value={newProject.rolloutDistance as string}
                      onChange={(e) => setNewProject({...newProject, rolloutDistance: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Scope of Work Brief (SOW)</label>
                  <textarea
                    placeholder="Describe deployment scope, technical parameters, and specific EHS requirements..."
                    value={newProject.description as string}
                    onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setShowAddProject(false);
                    setNewProject({
                      name: "",
                      description: "",
                      contractorId: "",
                      startDate: new Date().toISOString().split("T")[0],
                      endDate: "2026-12-31",
                      budget: "",
                      rolloutDistance: ""
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {actionLoading 
                    ? (editingProject ? "Saving..." : "Deploying...") 
                    : (editingProject ? "Save Changes" : "Launch Infrastructure")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
