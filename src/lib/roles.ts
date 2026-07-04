/**
 * Pure role-checking helpers.
 *
 * These functions are safe to import from client components because they
 * do not depend on any database or Node.js built-in modules.
 */

import { Role } from "../types";

const SAFARICOM_ROLES = new Set<string>([
  Role.SafaricomAdmin,
  Role.SafaricomProjectCreator,
  Role.SafaricomProjectAssigner,
  Role.SafaricomEHSOfficer,
]);

const CONTRACTOR_ROLES = new Set<string>([
  Role.ContractorManager,
  Role.ContractorEHSOfficer,
]);

/** Returns true if the role is a central Safaricom role. */
export function isSafaricomRole(role: string): boolean {
  return SAFARICOM_ROLES.has(role);
}

/** Returns true if the role is a contractor role. */
export function isContractorRole(role: string): boolean {
  return CONTRACTOR_ROLES.has(role);
}

/** Returns true if the role is Field Technician. */
export function isTechnician(role: string): boolean {
  return role === Role.Technician;
}
