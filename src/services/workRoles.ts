import { WorkRole, User } from "../types";
import { getAll, getById, insert, update, remove } from "../lib";

export async function getWorkRoles(): Promise<WorkRole[]> {
  return await getAll<WorkRole>("workRoles");
}

export async function createWorkRole(
  name: string,
  documentTypeIds: number[],
  currentUser: User
): Promise<WorkRole> {
  const id = await insert("workRoles", {
    name,
    documentTypeIds: documentTypeIds || []
  });

  const newRole: WorkRole = { id, name, documentTypeIds: documentTypeIds || [] };

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Role Created",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Created work role "${name}"`,
    contractorId: null
  });

  return newRole;
}

export async function updateWorkRole(
  id: number,
  updates: Partial<WorkRole>,
  currentUser: User
): Promise<WorkRole> {
  await update("workRoles", id, updates);

  const updated = await getById<WorkRole>("workRoles", id);
  if (!updated) throw new Error("Work role not found");

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Role Updated",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Updated role "${updated.name}"`,
    contractorId: null
  });

  return updated;
}

export async function deleteWorkRole(
  id: number,
  currentUser: User
): Promise<void> {
  const existing = await getById<WorkRole>("workRoles", id);
  const name = existing?.name || "";

  await remove("workRoles", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Role Deleted",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Deleted role "${name}"`,
    contractorId: null
  });
}
