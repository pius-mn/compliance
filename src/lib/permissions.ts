/**
 * Centralized permission and authorization helpers.
 *
 * All role checks, contractor data isolation guards, and access control
 * logic lives here so it stays consistent across services, routes, and views.
 *
 * NOTE: Pure role-checking functions (isSafaricomRole, isContractorRole,
 * isTechnician) live in ./roles.ts so they can be imported by client
 * components without pulling in Node.js database modules.
 */

import { getById } from "./database";

// Re-export pure role helpers for convenience — services importing from
// permissions.ts still get all the helpers they need.
export { isSafaricomRole, isContractorRole, isTechnician } from "./roles";

// ─── Contractor Data Access ──────────────────────────────────────────────────

/** Returns true if the user is central or the resource belongs to their contractor. */
export function canAccessContractorData(
  user: { isCentral: boolean; contractorId: number | null },
  resourceContractorId: number | null | undefined,
): boolean {
  if (user.isCentral) return true;
  if (!user.contractorId) return false;
  return user.contractorId === resourceContractorId;
}

/**
 * Throws if a non-central user tries to access a resource belonging to a
 * different contractor.
 */
export function guardContractorAccess(
  user: { isCentral: boolean; contractorId: number | null },
  resourceContractorId: number | null | undefined,
  resourceName = "resource",
): void {
  if (!canAccessContractorData(user, resourceContractorId)) {
    throw new Error(`Permission denied for this ${resourceName}.`);
  }
}

/** Throws unless the user has one of the given roles. */
export function requireRole(
  user: { role: string },
  allowedRoles: string[],
  errorMessage = "Permission denied.",
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new Error(errorMessage);
  }
}

// ─── Technician Hub Helper ───────────────────────────────────────────────────

interface HasContractorId {
  id?: number;
  contractorId?: number | null;
  userId?: number;
}

/**
 * Checks whether a technician belongs to the same contractor hub as the user.
 *
 * A technician is "in the hub" when:
 * - The user is central (Safaricom), OR
 * - The tech's `contractorId` directly matches the user's, OR
 * - The tech is managed by a contractor whose parent maps to the user's contractor
 *
 * This version queries the database directly instead of relying on an
 * in-memory snapshot (localDb).
 */
export async function isTechnicianInUserHub(
  tech: HasContractorId,
  user: { isCentral: boolean; contractorId: number | null },
): Promise<boolean> {
  if (!user) return false;
  if (user.isCentral) return true;
  if (!user.contractorId) return false;

  // Direct match
  if (tech.contractorId === user.contractorId) return true;

  // Indirect match via contractor hierarchy
  if (tech.contractorId) {
    const contractor = await getById<Record<string, unknown>>("contractors", tech.contractorId);
    if (contractor && contractor.contractorId === user.contractorId) return true;
  }

  return false;
}
