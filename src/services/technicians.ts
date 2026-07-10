import { User } from "../types";
import { getAll, getById, insert, update, remove, query } from "../lib";
import { recalculateTechnicianScore } from "./ehs";
import { isTechnicianInUserHub } from "../lib/permissions";
import { computeTechnicianEhsScore, buildApprovedDocLookup } from "../utils/helpers";

export async function getTechnicians(): Promise<Record<string, unknown>[]> {
  const [techs, workRoles, approvedDocRows] = await Promise.all([
    getAll<Record<string, unknown>>("technicians"),
    getAll<Record<string, unknown>>("workRoles"),
    // Only fetch approved docs with the minimal columns needed for score computation
    query(
      "SELECT technicianId, documentTypeId, rejected, contractorApproverId, centralApproverId, expiryDate FROM documents WHERE rejected = FALSE AND contractorApproverId IS NOT NULL AND centralApproverId IS NOT NULL"
    ),
  ]);

  const approvedDocLookup = buildApprovedDocLookup(
    approvedDocRows as { technicianId: number; documentTypeId: number | null; rejected: boolean; contractorApproverId: number | null; centralApproverId: number | null; expiryDate: string | null }[],
  );

  return techs.map((t) => ({
    ...t,
    overallEhsScore: computeTechnicianEhsScore(
      t.id as number,
      t.workRoleIds as number[] | undefined,
      workRoles as { id: number; documentTypeIds: number[] }[],
      approvedDocLookup,
    ),
  }));
}

/**
 * Lightweight version of getTechnicians for the compliance scanner.
 *
 * Projects only the columns needed by runComplianceScan() — id, name, status,
 * overallEhsScore — avoiding full-table SELECT * on the technicians table
 * (which includes phone TEXT, specialization TEXT, lastEhsAuditDate TEXT,
 * workRoleIds JSON, etc. that are never examined by the compliance engine).
 */
export async function getTechniciansForCompliance(): Promise<{
  id: number;
  name: string;
  status: string;
  overallEhsScore: number;
}[]> {
  const [techs, workRoles, approvedDocRows] = await Promise.all([
    query("SELECT id, name, status, workRoleIds FROM technicians"),
    getAll<Record<string, unknown>>("workRoles"),
    query(
      "SELECT technicianId, documentTypeId, rejected, contractorApproverId, centralApproverId, expiryDate FROM documents WHERE rejected = FALSE AND contractorApproverId IS NOT NULL AND centralApproverId IS NOT NULL"
    ),
  ]);

  const approvedDocLookup = buildApprovedDocLookup(
    approvedDocRows as { technicianId: number; documentTypeId: number | null; rejected: boolean; contractorApproverId: number | null; centralApproverId: number | null; expiryDate: string | null }[],
  );

  return techs.map((t) => ({
    id: t.id as number,
    name: t.name as string,
    status: t.status as string,
    overallEhsScore: computeTechnicianEhsScore(
      t.id as number,
      t.workRoleIds as number[] | undefined,
      workRoles as { id: number; documentTypeIds: number[] }[],
      approvedDocLookup,
    ),
  }));
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
