import { User } from "../types";
import { getAll, getById, insert, update, remove } from "../lib";
import { recalculateTechnicianScore } from "./ehs";
import { isTechnicianInUserHub } from "../lib/permissions";

export async function getTechnicians(): Promise<Record<string, unknown>[]> {
  return await getAll<Record<string, unknown>>("technicians");
}

export async function updateTechnicianRoles(
  id: number,
  workRoleIds: number[],
  userId: number | undefined,
  currentUser: User
): Promise<Record<string, unknown>> {
  const tech = await getById<Record<string, unknown>>("technicians", id);
  if (!tech) throw new Error("Technician not found");

  // Safety check - Contractor data isolation
  if (!await isTechnicianInUserHub(tech, currentUser)) {
    throw new Error("Permission denied for this technician.");
  }

  tech.workRoleIds = workRoleIds || [];
  await update("technicians", id, { workRoleIds: tech.workRoleIds });

  await recalculateTechnicianScore(id, true);

  await insert("auditLogs", {
    userId: userId || currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Technician Roles Updated",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Updated technician "${tech.name}" roles`,
    contractorId: (tech.contractorId as number | null) || null
  });

  return tech;
}

export async function updateTechnicianDetails(
  id: number,
  details: { name?: string; phone?: string; specialization?: string; email?: string },
  currentUser: User
): Promise<Record<string, unknown>> {
  const tech = await getById<Record<string, unknown>>("technicians", id);
  if (!tech) throw new Error("Technician not found");

  if (!await isTechnicianInUserHub(tech, currentUser)) {
    throw new Error("Permission denied for this technician.");
  }

  const { name, phone, specialization, email } = details;

  const techUpdates: Record<string, unknown> = {};
  if (name) techUpdates.name = name;
  if (phone) techUpdates.phone = phone;
  if (specialization) techUpdates.specialization = specialization;

  if (Object.keys(techUpdates).length > 0) {
    await update("technicians", id, techUpdates);
  }

  // Update linked user if applicable
  if (tech.userId && (name || email)) {
    const userUpdates: Record<string, unknown> = {};
    if (name) userUpdates.name = name;
    if (email) userUpdates.email = email;
    if (Object.keys(userUpdates).length > 0) {
      await update("users", tech.userId as number, userUpdates);
    }
  }

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Technician Updated",
    category: "User Management",
    timestamp: new Date().toISOString(),
    details: `Updated technician "${name || tech.name}" details`,
    contractorId: (tech.contractorId as number | null) || null
  });

  // Re-fetch the updated technician
  return (await getById<Record<string, unknown>>("technicians", id))!;
}

export async function deleteTechnician(
  id: number,
  currentUser: User
): Promise<void> {
  const tech = await getById<Record<string, unknown>>("technicians", id);
  if (!tech) throw new Error("Technician not found");

  if (!await isTechnicianInUserHub(tech, currentUser)) {
    throw new Error("Permission denied for this technician.");
  }

  // Delete associated user
  if (tech.userId) {
    await remove("users", tech.userId as number);
  }

  const techName = tech.name as string;
  const techContractorId = (tech.contractorId as number | null) || null;

  await remove("technicians", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Technician Deleted",
    category: "User Management",
    timestamp: new Date().toISOString(),
    details: `Deleted technician "${techName}"`,
    contractorId: techContractorId
  });
}
