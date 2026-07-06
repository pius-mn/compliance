import { Project, User } from "../types";
import { getAll, getById, getWhere, insert, update, remove, query } from "../lib";
import { guardContractorAccess, isContractorRole } from "../lib/permissions";
import { computeTechnicianEhsScore, buildApprovedDocLookup } from "../utils/helpers";

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

  // Contractors can only add technicians that are 100% EHS compliant
  if (updates.assignedTechnicianIds && isContractorRole(currentUser.role)) {
    const originalIds: number[] = original.assignedTechnicianIds || [];
    const newIds = updates.assignedTechnicianIds.filter(
      (id: number) => !originalIds.includes(id)
    );

    if (newIds.length > 0) {
      const [workRoles, approvedDocRows, techRows] = await Promise.all([
        getAll<{ id: number; documentTypeIds: number[] }>("workRoles"),
        query(
          "SELECT technicianId, documentTypeId, rejected, contractorApproverId, centralApproverId, expiryDate FROM documents WHERE rejected = FALSE AND contractorApproverId IS NOT NULL AND centralApproverId IS NOT NULL"
        ),
        getWhere<{ id: number; name: string; workRoleIds: number[] | null }>(
          "technicians",
          `id IN (${newIds.map(() => "?").join(",")})`,
          newIds
        ),
      ]);

      const approvedDocLookup = buildApprovedDocLookup(
        approvedDocRows as Parameters<typeof buildApprovedDocLookup>[0]
      );

      const failures: { id: number; name: string; score: number }[] = [];
      for (const tech of techRows as { id: number; name: string; workRoleIds: number[] | null }[]) {
        const score = computeTechnicianEhsScore(
          tech.id,
          tech.workRoleIds || [],
          workRoles,
          approvedDocLookup
        );

        if (score < 100) {
          failures.push({ id: tech.id, name: tech.name, score });
        }
      }

      if (failures.length > 0) {
        const detail = failures
          .map(f => `${f.name} (ID #${f.id}, score: ${f.score}%)`)
          .join("; ");
        throw new Error(
          `Cannot authorize the following technicians — they do not have 100% EHS compliance: ${detail}. Only fully compliant technicians can be authorized by contractors.`
        );
      }
    }
  }

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
