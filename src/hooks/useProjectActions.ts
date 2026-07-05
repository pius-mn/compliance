import React from "react";
import { Project, Milestone } from "../types";
import { safeJson, safeString } from "../utils/helpers";
import { apiFetch, apiFetchJson } from "../utils/apiFetch";
import type { CollectionKey } from "../utils/dataSync";

interface ProjectActionStates {
  user: { id?: number | string; role?: string; contractorId?: number | string } | null;
  selectedProjectId: number | string | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<number | string | null>>;
  newProject: Record<string, unknown>;
  setNewProject: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  setShowAddProject: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddMilestone: React.Dispatch<React.SetStateAction<boolean>>;
  newMilestone: Record<string, unknown>;
  setNewMilestone: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  milestones: Milestone[];
  setMilestones: React.Dispatch<React.SetStateAction<Milestone[]>>;
  allMilestones: Milestone[];
  setAllMilestones: React.Dispatch<React.SetStateAction<Milestone[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setSitePhotos: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>;
  setActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
  allUsers: Record<string, unknown>[];
  contractors: Record<string, unknown>[];
}

export function useProjectActions(
  states: ProjectActionStates,
  API_BASE: string,
  triggerBannerAlert: (type: "success" | "error" | "info" | "warning", msg: string) => void,
  refetchData: (collections: CollectionKey[]) => Promise<void>
) {
  const {
    user,
    selectedProjectId,
    setSelectedProjectId,
    newProject,
    setNewProject,
    setShowAddProject,
    setShowAddMilestone,
    newMilestone,
    setNewMilestone,
    milestones,
    setMilestones,
    allMilestones,
    setAllMilestones,
    projects,
    setProjects,
    setSitePhotos,
    setActionLoading,
    allUsers,
    contractors,
  } = states;

  const fetchMilestones = async (projId: number | string) => {
    try {
      const res = await apiFetch(`${API_BASE}/projects/${projId}/milestones`);
      if (res.ok) {
        const data = await safeJson(res);
        setMilestones(Array.isArray(data) ? data : []);
      } else {
        setMilestones([]);
      }
    } catch (e) {
      console.error(e);
      setMilestones([]);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) {
      triggerBannerAlert("error", "Please configure the site name first.");
      return;
    }
    setActionLoading(true);
    try {
      const userRole = user?.role;
      const finalContractorId = userRole === "Safaricom Project Creator" ? 0 : (Number(newProject.contractorId) || 0);
      const res = await apiFetchJson(`${API_BASE}/projects`, {
        method: "POST",
        body: {
          ...newProject,
          contractorId: finalContractorId,
          rolloutDistance: parseFloat(newProject.rolloutDistance as string) || 0
        }
      });
      if (res.ok) {
        const data = await safeJson(res) as Record<string, unknown>;
        setProjects((prev: Project[]) => [...prev, data as unknown as Project]);
        setSelectedProjectId(data?.id as number);
        setMilestones([]);
        if (data?.id) fetchMilestones(data.id as number);
        setShowAddProject(false);
        setNewProject({
          name: "",
          description: "",
          contractorId: userRole === "Safaricom Project Creator" ? "" : (user?.contractorId || ""),
          startDate: new Date().toISOString().split("T")[0],
          endDate: "2026-12-31",
          budget: "",
          rolloutDistance: ""
        });
        triggerBannerAlert("success", "Safaricom Project successfully tracked!");
        refetchData(["projects", "milestones"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "An error occurred");
      }
    } catch {
      triggerBannerAlert("error", "Connection error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.title || !selectedProjectId) {
      triggerBannerAlert("error", "Ensure title & target project is selected.");
      return;
    }
    
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/projects/${selectedProjectId}/milestones`, {
        method: "POST",
        body: { ...newMilestone, userId: user?.id }
      });
      if (res.ok) {
        const added = await safeJson(res) as Record<string, unknown>;
        setMilestones((prev: Milestone[]) => [...prev, added as unknown as Milestone]);
        setAllMilestones((prev: Milestone[]) => [...prev, added as unknown as Milestone]);
        setShowAddMilestone(false);
        setNewMilestone({
          title: "",
          description: "",
          dueDate: new Date().toISOString().split("T")[0],
          dependencies: [],
        });
        triggerBannerAlert("success", "New safety milestone added!");
        refetchData(["milestones"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to create milestone");
      }
    } catch {
      triggerBannerAlert("error", "Error contacting server.");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteSitePhoto = async (photoId: number | string) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/site-photos/${photoId}`, { method: "DELETE" });
      if (res.ok) {
        setSitePhotos((prev: Record<string, unknown>[]) => prev.filter(p => p.id !== photoId));
        triggerBannerAlert("success", "Photo deleted successfully!");
      } else {
        triggerBannerAlert("error", "Failed to delete photo.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMilestoneStatus = async (milestoneId: number | string, status: Milestone["status"], comments?: string) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/milestones/${milestoneId}`, {
        method: "PUT",
        body: { status, userId: user?.id, statusComments: comments }
      });

      if (res.ok) {
        triggerBannerAlert("success", `Marked milestone status as: ${status}`);
        if (selectedProjectId) fetchMilestones(selectedProjectId);
        refetchData(["milestones"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Unauthorized action or state block.");
      }
    } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMilestoneClearedDependencies = async (milestoneId: number | string, clearedDependencies: (number | string)[]) => {
    setActionLoading(true);
    try {
      const milestone = milestones.find((m: Milestone) => m.id === milestoneId);
      if (!milestone) throw new Error("Milestone not found");

      const res = await apiFetchJson(`${API_BASE}/milestones/${milestoneId}`, {
        method: "PUT",
        body: { status: milestone.status, clearedDependencies, userId: user?.id }
      });

      if (res.ok) {
        triggerBannerAlert("success", "Dependencies clearance updated!");
        if (selectedProjectId) await fetchMilestones(selectedProjectId);
        refetchData(["milestones"]);
      } else {
        const errorText = await res.text();
        let err: Record<string, unknown>;
        try { err = JSON.parse(errorText); } catch { err = { error: "Failed, check console" }; }
        triggerBannerAlert("error", (err?.error as string) || "Failed to update dependencies");
      }
    } catch {
      triggerBannerAlert("error", "Failed to update dependencies");
    } finally {
      setActionLoading(false);
    }
  };

  const uploadSitePhoto = async (projectId: number | string, photoData: string, description: string) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/site-photos`, {
        method: "POST",
        body: { projectId, photoData, description },
      });
      if (res.ok) {
        triggerBannerAlert("success", "Photo uploaded successfully!");
        await refetchData(["sitePhotos"]);
      } else {
        const err = await res.json();
        let errMsg = "Unknown error";
        try { errMsg = safeString((err as Record<string, unknown>).error); } catch { errMsg = "Object error"; }
        triggerBannerAlert("error", "Upload failed: " + errMsg);
      }
    } catch {
      triggerBannerAlert("error", "Upload failed: Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const triggerComplianceScan = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/compliance/scan`, { method: "POST" });
      const data = await safeJson(res) as Record<string, unknown>;
      if (res.ok) {
        triggerBannerAlert("success", `Regulatory audit sweep finished! Detected ${data.newFlagsCount} new flags, resolved ${data.updatedFlagsCount} flags.`);
        refetchData(["complianceFlags", "notifications", "auditLogs"]);
      } else {
        triggerBannerAlert("error", "Compliance scan failed.");
      }
    } catch (e) {
      console.error(e);
      triggerBannerAlert("error", "Connection error during compliance scan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveComplianceFlag = async (flagId: number | string, comments: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/compliance/flags/${flagId}/resolve`, {
        method: "POST",
        body: { comments }
      });
      if (res.ok) {
        triggerBannerAlert("success", "Compliance warning resolved and archived in audit logs.");
        refetchData(["complianceFlags"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to resolve compliance flag.");
      }
    } catch {
      triggerBannerAlert("error", "Network error during flag resolution.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProjectTechnicians = async (projectId: number | string, assignedTechnicianIds: (number | string)[]) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        body: { assignedTechnicianIds }
      });

      if (res.ok) {
        triggerBannerAlert("success", "Project crew updated successfully.");
        refetchData(["projects", "technicians"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to update project crew.");
      }      } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProject = async (projectId: number | string, updates: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        body: updates
      });

      if (res.ok) {
        triggerBannerAlert("success", "Project updated successfully.");
        refetchData(["projects"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to update project.");
      }
    } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: number | string) => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/projects/${projectId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        triggerBannerAlert("success", "Project deleted successfully.");
        setSelectedProjectId(null);
        refetchData(["projects"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to delete project.");
      }
    } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignProject = async (
    projectId: number | string,
    updates: {
      contractorId?: number | string | null;
      projectLeadId?: number | string | null;
      ehsOfficerId?: number | string | null;
    }
  ) => {
    setActionLoading(true);
    try {
      const res = await apiFetchJson(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        body: updates
      });

      if (res.ok) {
        triggerBannerAlert("success", "Project assignment updated successfully.");
        refetchData(["projects", "users"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to update project assignments.");
      }
    } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMilestoneDependencies = async (milestoneId: number | string, dependencies: (number | string)[]) => {
    setActionLoading(true);
    try {
      const milestone = milestones.find((m: Milestone) => m.id === milestoneId);
      if (!milestone) throw new Error("Milestone not found");

      const res = await apiFetchJson(`${API_BASE}/milestones/${milestoneId}`, {
        method: "PUT",
        body: { status: milestone.status, dependencies, userId: user?.id }
      });

      if (res.ok) {
        triggerBannerAlert("success", "Milestone dependencies updated!");
        if (selectedProjectId) await fetchMilestones(selectedProjectId);
        refetchData(["milestones"]);
      } else {
        const err = await safeJson(res) as Record<string, unknown>;
        triggerBannerAlert("error", (err?.error as string) || "Failed to update dependencies");
      }
    } catch {
      triggerBannerAlert("error", "Server communication failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportProjects = () => {
    if (!projects || projects.length === 0) {
      triggerBannerAlert("warning", "No projects to export.");
      return;
    }
    
    // Prepare CSV data
    const headers = ["ID", "Name", "Description", "Contractor", "Project Lead", "EHS Officer", "Start Date", "End Date", "Budget", "Rollout Distance", "Current Milestone"];
    const rows = projects.map((p: Project) => {
      const contractor = (contractors || []).find((c: Record<string, unknown>) => c.id === p.contractorId);
      const lead = (allUsers || []).find((u: Record<string, unknown>) => u.id === p.projectLeadId);
      const ehs = (allUsers || []).find((u: Record<string, unknown>) => u.id === p.ehsOfficerId);
      
      const projectMilestones = allMilestones.filter((m: Milestone) => m.projectId === p.id);
      const currentMilestone = projectMilestones.find((m: Milestone) => m.status === "In Progress") || projectMilestones.find((m: Milestone) => m.status === "Pending") || projectMilestones[0];

      return [
        p.id,
        p.name,
        p.description,
        contractor?.name || p.contractorId || "N/A",
        lead?.name || p.projectLeadId || "N/A",
        ehs?.name || p.ehsOfficerId || "N/A",
        p.startDate,
        p.endDate,
        p.budget,
        p.rolloutDistance,
        currentMilestone?.title || "N/A"
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => `"${row.join('","')}"`).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "all_projects.csv";
    link.click();
    URL.revokeObjectURL(url);
    triggerBannerAlert("success", "Projects exported successfully.");
  };

  return {
    fetchMilestones,
    handleCreateProject,
    handleCreateMilestone,
    deleteSitePhoto,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneClearedDependencies,
    handleUpdateMilestoneDependencies,
    uploadSitePhoto,
    triggerComplianceScan,
    handleResolveComplianceFlag,
    handleUpdateProjectTechnicians,
    handleAssignProject,
    handleUpdateProject,
    handleDeleteProject,
    handleExportProjects
  };
}
