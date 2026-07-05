import { Role, Contractor } from "../types";

/**
 * Generate the next sequential integer ID for a collection.
 * Finds the max existing ID and returns max + 1.
 * Returns 1 if the collection is empty.
 */
export function nextId(items: { id: number }[]): number {
  return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
}

/** Get the next ID from a local DB snapshot for a specific table */
export function getNextId(data: Record<string, unknown>, table: string): number {
  const items = (data[table] as unknown[]) || [];
  return items.length > 0 ? Math.max(...items.map((i: unknown) => (i as Record<string, unknown>).id as number)) + 1 : 1;
}

// Helper for safe JSON parsing
export async function safeJson(res: Response) {
  try {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch (e) {
    console.error("JSON parse error:", e);
  }
  return null;
}

// Friendly role label helper
export const getFriendlyRoleLabel = (role: Role | undefined) => {
  if (!role) return "";
  switch (role) {
    case Role.SafaricomAdmin: return "Safaricom Central Admin";
    case Role.SafaricomProjectCreator: return "Safaricom Project Creator";
    case Role.SafaricomProjectAssigner: return "Safaricom Project Assigner";
    case Role.SafaricomEHSOfficer: return "Safaricom Central EHS Officer";
    case Role.ContractorManager: return "Contractor Manager";
    case Role.ContractorEHSOfficer: return "Contractor Safety Lead";
    case Role.Technician: return "Field Technician";
    default: return role;
  }
};

// Friendly contractor partner label helper
export const getActiveContractorLabel = (
  contractorId: number | string | null,
  contractors: Contractor[],
  isUserLabel: boolean = false,
  cleanMode: boolean = false
) => {
  if (contractorId === null || contractorId === undefined || contractorId === "unassigned") {
    return isUserLabel ? "Safaricom Central Safety Command" : "Unassigned / Pending Contractor Allocation";
  }
  const b = (contractors || []).find(br => br && br.id === Number(contractorId));
  if (!b) return "Contractor Scope";
  const safeStr = (v: unknown) => {
    try { return String(v); } catch { return ""; }
  };
  if (cleanMode) {
    return safeStr(b.name || "");
  }
  return `${safeStr(b.name || "")} (${safeStr(b.code || "")})`;
};

export const safeNumber = (v: unknown, fallback: number = 0): number => {
  if (typeof v === 'number') return isNaN(v) ? fallback : v;
  try {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
};

export const safeString = (v: unknown, fallback: string = ""): string => {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  try {
    return String(v);
  } catch {
    return fallback;
  }
};

/**
 * Build a lookup map: techId → Set of document type IDs that have at least
 * one approved + non-expired document.
 *
 * Resolves name-based document type matches (when a document has no
 * documentTypeId but its `type` matches a DocumentType name).
 */
export function buildApprovedDocLookup(
  documents: { technicianId: number; documentTypeId: number | null; rejected: boolean; contractorApproverId: number | null; centralApproverId: number | null; expiryDate: string | null }[],
): Map<number, Set<number>> {
  const lookup = new Map<number, Set<number>>();
  const now = Date.now();

  for (const doc of documents) {
    // Only fully-approved (not rejected, both approvers set) documents count
    if (doc.rejected) continue;
    if (!doc.contractorApproverId || !doc.centralApproverId) continue;
    // Skip expired documents
    if (doc.expiryDate && new Date(doc.expiryDate).getTime() < now) continue;

    if (!doc.documentTypeId) continue;

    let set = lookup.get(doc.technicianId);
    if (!set) {
      set = new Set<number>();
      lookup.set(doc.technicianId, set);
    }
    set.add(doc.documentTypeId);
  }

  return lookup;
}

/**
 * Compute a technician's overallEhsScore on-the-fly from their work roles
 * and a pre-built approved-document lookup.
 *
 * @param techId - Technician ID
 * @param workRoleIds - IDs of the work roles assigned to this technician
 * @param workRoles - All work roles (used to map role IDs to document type IDs)
 * @param approvedDocLookup - techId → Set of approved document type IDs
 *
 * Returns 100 when no documents are required (no roles or roles with no
 * document type requirements). Returns 0 when no roles are assigned.
 */

/**
 * Compute the display status of a document from its approval fields.
 *
 * The `documents` table no longer stores a `status` column; status is
 * derived from `rejected`, `contractorApproverId`, and `centralApproverId`.
 */
export function getDocStatus(doc: {
  rejected: boolean;
  contractorApproverId: number | null | undefined;
  centralApproverId: number | null | undefined;
}): "Approved" | "Pending Central Approval" | "Pending Contractor Approval" | "Rejected" {
  if (doc.rejected) return "Rejected";
  if (doc.contractorApproverId && doc.centralApproverId) return "Approved";
  if (doc.contractorApproverId) return "Pending Central Approval";
  return "Pending Contractor Approval";
}

export function computeTechnicianEhsScore(
  techId: number,
  workRoleIds: number[] | undefined,
  workRoles: { id: number; documentTypeIds: number[] }[],
  approvedDocLookup: Map<number, Set<number>>
): number {
  if (!workRoleIds || workRoleIds.length === 0) return 0;

  const requiredDocTypeIds = new Set<number>();
  for (const roleId of workRoleIds) {
    const role = workRoles.find((r) => r.id === roleId);
    if (role && role.documentTypeIds) {
      role.documentTypeIds.forEach((id) => requiredDocTypeIds.add(id));
    }
  }

  if (requiredDocTypeIds.size === 0) return 100;

  const techApproved = approvedDocLookup.get(techId);
  if (!techApproved || techApproved.size === 0) return 0;

  let approvedCount = 0;
  for (const reqDocId of requiredDocTypeIds) {
    if (techApproved.has(reqDocId)) approvedCount++;
  }

  return Math.round((approvedCount / requiredDocTypeIds.size) * 100);
}


