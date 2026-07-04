import { Milestone, User } from "../types";
import { getAll, getById, getWhere, insert, update } from "../lib";

export const PREDEFINED_MILESTONES = [
  "High-Level Design & Feasibility",
  "Site Survey & Route Validation",
  "Permitting & Right of Way (RoW)",
  "Detailed Low-Level Design (LLD)",
  "Procurement of Materials",
  "Civil Works & Trenching",
  "Duct & Pole Installation",
  "Fiber Cable Deployment",
  "Splicing & Termination",
  "Testing & Commissioning (OTDR)",
  "Active Equipment Installation",
  "Ready for Service (RFS) Handover"
];

export const PREDEFINED_PREREQUISITES = [
  "Rollout Distance Approval",
  "Way Leave Clearance",
  "Site Access Permission",
  "Permits & Regulatory Approval",
  "Material Procurement Lead Time"
];

export async function getMilestones(): Promise<Milestone[]> {
  return await getAll<Milestone>("milestones");
}

export async function createProjectMilestone(
  projectId: number,
  milestoneData: Partial<Milestone>,
  currentUser: User
): Promise<Milestone> {
  const project = await getById<Record<string, unknown>>("projects", projectId);
  if (!project) throw new Error("Project not found");

  // Security check
  if (!currentUser.isCentral && project.contractorId !== currentUser.contractorId) {
    throw new Error("Permission denied for this project data.");
  }

  // Restriction: only contractors
  if (currentUser.role !== "Contractor Manager" && currentUser.role !== "Contractor Safety Lead") {
    throw new Error("Only contractors can add milestones.");
  }

  const existingProjectMilestones = await getWhere<Milestone>("milestones", "projectId = ?", [projectId]);
  
  // Sequential validation
  const expectedIndex = existingProjectMilestones.length;
  if (expectedIndex >= PREDEFINED_MILESTONES.length) {
    throw new Error("All milestones have been added for this project.");
  }
  
  // Ensure previous is completed
  if (existingProjectMilestones.length > 0) {
    const lastMilestone = existingProjectMilestones[existingProjectMilestones.length - 1];
    if (lastMilestone.status !== "Completed") {
      throw new Error(`Cannot add next milestone. Milestone "${lastMilestone.title}" must be completed first.`);
    }
  }
  
  const expectedTitle = PREDEFINED_MILESTONES[expectedIndex];
  if (milestoneData.title !== expectedTitle) {
    throw new Error(`Milestones must be added sequentially. Next expected: "${expectedTitle}"`);
  }

  // Auto-chain sequential dependency if none is specified
  let computedDependencies: number[] = milestoneData.dependencies || [];
  if (computedDependencies.length === 0 && existingProjectMilestones.length > 0) {
    const lastMilestone = existingProjectMilestones[existingProjectMilestones.length - 1];
    computedDependencies = [lastMilestone.id];
  }

  const id = await insert("milestones", {
    projectId,
    title: milestoneData.title,
    description: milestoneData.description || "",
    status: "Pending",
    dueDate: milestoneData.dueDate || new Date().toISOString().split("T")[0],
    weight: Number(milestoneData.weight) || 10,
    dependencies: computedDependencies,
    prerequisites: milestoneData.prerequisites || [],
    clearedPrerequisites: [],
    clearedDependencies: [],
    prerequisiteNotes: milestoneData.prerequisiteNotes || "",
    completedAt: null
  });

  const newMilestone: Milestone = {
    id,
    projectId,
    title: milestoneData.title!,
    description: milestoneData.description || "",
    status: "Pending",
    dueDate: milestoneData.dueDate || new Date().toISOString().split("T")[0],
    weight: Number(milestoneData.weight) || 10,
    dependencies: computedDependencies,
    prerequisites: milestoneData.prerequisites || [],
    clearedPrerequisites: [],
    clearedDependencies: [],
    prerequisiteNotes: milestoneData.prerequisiteNotes || "",
    completedAt: null
  };

  // Update project milestones count
  const allMilestones = await getWhere<Milestone>("milestones", "projectId = ?", [projectId]);
  const total = allMilestones.length;
  const completed = allMilestones.filter(m => m.status === "Completed").length;
  await update("projects", projectId, {
    milestonesCount: { total, completed }
  });

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Milestone Added",
    category: "Project Management",
    timestamp: new Date().toISOString(),
    details: `Added milestone "${newMilestone.title}" to project "${project.name}"`,
    contractorId: project.contractorId
  });

  return newMilestone;
}

export async function updateMilestone(
  id: number,
  updates: Partial<Milestone>,
  currentUser: User
): Promise<Milestone> {
  const milestone = await getById<Milestone>("milestones", id);
  if (!milestone) throw new Error("Milestone not found");

  const m = { ...milestone };

  // Lock check: block if subsequent milestones exist
  const projectMilestones = await getWhere<Milestone>("milestones", "projectId = ?", [m.projectId]);
  const milestoneIndex = projectMilestones.findIndex(x => x.id === m.id);
  if (milestoneIndex !== -1 && milestoneIndex < projectMilestones.length - 1) {
    throw new Error("Cannot perform operations on this milestone. It is locked because a subsequent milestone has been added.");
  }

  const { status, prerequisites, clearedPrerequisites, clearedDependencies, statusComments, dependencies } = updates;

  // Build partial update for fields being changed
  const fieldsToUpdate: Record<string, unknown> = {};

  if (dependencies !== undefined) fieldsToUpdate.dependencies = dependencies;
  if (prerequisites !== undefined) fieldsToUpdate.prerequisites = prerequisites;
  if (clearedPrerequisites !== undefined) fieldsToUpdate.clearedPrerequisites = clearedPrerequisites;
  if (clearedDependencies !== undefined) fieldsToUpdate.clearedDependencies = clearedDependencies;
  if (statusComments !== undefined) fieldsToUpdate.statusComments = statusComments;

  // Revert check: status changing from "Completed" to something else
  if (m.status === "Completed" && status !== "Completed" && status !== undefined) {
    const dependentCompleted = projectMilestones.filter(
      dep => dep.dependencies.includes(m.id) && dep.status === "Completed"
    );
    if (dependentCompleted.length > 0) {
      throw new Error(`Cannot revert milestone status. Subsequent completed milestones depend on this: ${dependentCompleted.map(d => d.title).join(", ")}`);
    }
  }

  const project = await getById<Record<string, unknown>>("projects", m.projectId);
  if (!project) throw new Error("Linked project not found");

  if (!currentUser.isCentral && project.contractorId !== currentUser.contractorId) {
    throw new Error("Permission denied for this project data.");
  }

  // Complete check: status changing to Completed
  if (status === "Completed") {
    const uncompletedDependencies = projectMilestones.filter(
      dep => m.dependencies.includes(dep.id) && dep.status !== "Completed"
    );
    if (uncompletedDependencies.length > 0) {
      throw new Error(`Cannot complete milestone. Blocking dependencies must be completed first: ${uncompletedDependencies.map(d => d.title).join(", ")}`);
    }

    // Check custom/constraint dependencies
    if (m.dependencies && m.dependencies.length > 0) {
      const otherMilestoneIds = projectMilestones.map(x => x.id);
      const constraints = m.dependencies.filter(d => !otherMilestoneIds.includes(d));
      const unclearedConstraints = constraints.filter(c => !(m.clearedDependencies || []).includes(c));
      if (unclearedConstraints.length > 0) {
        throw new Error(`Cannot complete milestone. Blocking dependencies must be cleared first: ${unclearedConstraints.join(", ")}`);
      }
    }

    // Check prerequisites
    if (m.prerequisites && m.prerequisites.length > 0) {
      const uncleared = m.prerequisites.filter(p => !(m.clearedPrerequisites || []).includes(p));
      if (uncleared.length > 0) {
        throw new Error(`Cannot complete milestone. Blocking prerequisites must be cleared first: ${uncleared.join(", ")}`);
      }
    }
  }

  const oldStatus = m.status;
  if (status !== undefined) {
    fieldsToUpdate.status = status;
    if (status === "Completed") {
      fieldsToUpdate.completedAt = m.completedAt || new Date().toISOString().split("T")[0];
    } else {
      fieldsToUpdate.completedAt = null;
    }
  }

  // Apply update
  if (Object.keys(fieldsToUpdate).length > 0) {
    await update("milestones", id, fieldsToUpdate);
  }

  // Update project milestones count and possibly status
  const updatedProjectMilestones = await getWhere<Milestone>("milestones", "projectId = ?", [m.projectId]);
  const total = updatedProjectMilestones.length;
  const completedCount = updatedProjectMilestones.filter(x => x.status === "Completed").length;
  
  const projectUpdates: Record<string, unknown> = {
    milestonesCount: { total, completed: completedCount }
  };
  
  if (completedCount === total && total > 0) {
    projectUpdates.status = "Completed";
  } else if (project.status === "Planning" && completedCount > 0) {
    projectUpdates.status = "In Progress";
  }
  
  await update("projects", m.projectId, projectUpdates);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Milestone Updated",
    category: "Project Management",
    timestamp: new Date().toISOString(),
    details: `Updated milestone "${m.title}" status from "${oldStatus}" to "${status || oldStatus}"`,
    contractorId: project.contractorId
  });

  const result = await getById<Milestone>("milestones", id);
  return result!;
}
