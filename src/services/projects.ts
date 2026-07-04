import { Project, User } from "../types";
import { getAll, getById, insert, update, remove } from "../lib";
import { guardContractorAccess } from "../lib/permissions";

export async function getProjects(): Promise<Project[]> {
  return await getAll<Project>("projects");
}

export async function addProject(
  projectData: Omit<Project, "id"> & { id?: number },
  currentUser: User
): Promise<Project> {
  // Omit explicit id — let the database auto-generate it
  const { ...cleanData } = projectData as Omit<Project, "id"> & { id?: number };

  // Let the database auto-generate the ID
  const projectId = await insert("projects", {
    ...cleanData,
    status: cleanData.status || "Planning",
    milestonesCount: cleanData.milestonesCount || { total: 0, completed: 0 }
  });

  const newProject: Project = {
    ...cleanData,
    id: projectId,
    status: cleanData.status || "Planning",
    milestonesCount: cleanData.milestonesCount || { total: 0, completed: 0 }
  };

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Project Created",
    category: "Project Management",
    timestamp: new Date().toISOString(),
    details: `Safaricom Project successfully tracked! "${newProject.name}"`,
    contractorId: newProject.contractorId !== 0 ? newProject.contractorId : null
  });

  return newProject;
}

export async function updateProject(
  id: number,
  updates: Partial<Project>,
  currentUser: User
): Promise<Project> {
  const original = await getById<Project>("projects", id);
  if (!original) throw new Error("Project not found");

  guardContractorAccess(currentUser, original.contractorId, "project");

  // Clean updates - cast removes extra properties like branchId (legacy column)
  const cleanUpdates = updates as Partial<Project>;
  const updatedData = {
    ...cleanUpdates,
    milestonesCount: cleanUpdates.milestonesCount || original.milestonesCount || { total: 0, completed: 0 }
  };

  await update("projects", id, updatedData);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Project Updated",
    category: "Project Management",
    timestamp: new Date().toISOString(),
    details: `Updated project "${original.name}" settings/assignments`,
    contractorId: original.contractorId !== 0 ? original.contractorId : null
  });

  const updated = await getById<Project>("projects", id);
  return updated!;
}

export async function deleteProject(
  id: number,
  currentUser: User
): Promise<void> {
  const project = await getById<Project>("projects", id);
  if (!project) throw new Error("Project not found");

  const name = project.name;
  const contractorId = project.contractorId;

  guardContractorAccess(currentUser, contractorId, "project");

  await remove("projects", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Project Deleted",
    category: "Project Management",
    timestamp: new Date().toISOString(),
    details: `Deleted project "${name}"`,
    contractorId: contractorId !== 0 ? contractorId : null
  });
}
