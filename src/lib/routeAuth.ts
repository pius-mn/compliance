/**
 * Route-level authentication and authorization helper.
 *
 * Replace the manual `getAuthenticatedUser` + `requireRole` + `guardContractorAccess`
 * pattern in every route handler with a single declarative call.
 *
 * @example
 *   // Simple auth-only
 *   const auth = await requireAuth(req);
 *   if ("error" in auth) return auth.error;
 *
 * @example
 *   // Role-gated
 *   const auth = await requireAuth(req, { allowedRoles: ["Safaricom Admin"] });
 *   if ("error" in auth) return auth.error;
 *
 * @example
 *   // Central-only + contractor isolation
 *   const auth = await requireAuth(req, {
 *     requireCentral: true,
 *     contractorId: project.contractorId
 *   });
 *   if ("error" in auth) return auth.error;
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "./auth";
import { isSafaricomRole, canAccessContractorData, requireRole } from "./permissions";
import { User } from "../types";

// ─── Options ─────────────────────────────────────────────────────────────────

export interface RouteAuthOptions {
  /** Roles permitted to access this route. Empty = any authenticated user. */
  allowedRoles?: string[];
  /** If true, only central (Safaricom) users are allowed. */
  requireCentral?: boolean;
  /**
   * The resource's contractor ID. When provided, non-central users must belong
   * to the same contractor. Mutually exclusive with `getContractorId`.
   */
  contractorId?: number | null;
  /**
   * Callback to dynamically extract the resource's contractor ID from the request.
   * Called after authentication succeeds. Mutually exclusive with `contractorId`.
   */
  getContractorId?: (req: Request) => number | null | undefined;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface AuthSuccess {
  user: User;
  isSafaricom: boolean;
}

export type AuthResult =
  | AuthSuccess
  | { error: NextResponse };

// ─── requireAuth ─────────────────────────────────────────────────────────────

export async function requireAuth(
  req: Request,
  options?: RouteAuthOptions,
): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // ── Central-only check ──────────────────────────────────────────────────
  if (options?.requireCentral && !user.isCentral) {
    return {
      error: NextResponse.json(
        { error: "Only central roles can perform this action." },
        { status: 403 },
      ),
    };
  }

  // ── Role check ──────────────────────────────────────────────────────────
  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    try {
      requireRole(user, options.allowedRoles);
    } catch {
      return {
        error: NextResponse.json(
          { error: "Your role does not have permission for this action." },
          { status: 403 },
        ),
      };
    }
  }

  // ── Contractor isolation check ──────────────────────────────────────────
  const resourceContractorId =
    options?.contractorId !== undefined
      ? options.contractorId
      : options?.getContractorId
        ? options.getContractorId(req)
        : undefined;

  if (resourceContractorId !== undefined) {
    if (!canAccessContractorData(user, resourceContractorId)) {
      return {
        error: NextResponse.json(
          { error: "Permission denied for this resource." },
          { status: 403 },
        ),
      };
    }
  }

  return {
    user,
    isSafaricom: isSafaricomRole(user.role),
  };
}
