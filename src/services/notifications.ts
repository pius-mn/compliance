import { Notification, User } from "../types";
import { query, updateWhere } from "../lib";

export interface NotificationFilter {
  /** Filter to notifications targeting this contractor (or broadcasts). */
  contractorId?: number | null;
  /** Filter to notifications targeting this role (or broadcasts). */
  role?: string;
  /** Filter to notifications targeting this user directly (or broadcasts). */
  userId?: number;
  /** Page number (1-based). Omit to return all matching results. */
  page?: number;
  /** Results per page. Omit to return all matching results. */
  limit?: number;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
}

/**
 * Fetch notifications with filter conditions pushed down to SQL.
 *
 * Instead of loading ALL rows and filtering in JS, this builds a WHERE clause
 * that matches the user's visibility scope — broadcasts, contractor-targeted,
 * role-targeted, and user-targeted notifications — and only returns relevant
 * rows from the database.
 *
 * The new indexes (idx_notifications_contractor_id, idx_notifications_user_id)
 * make these lookups O(log n) instead of a full table scan.
 */
export async function getFilteredNotifications(
  filter: NotificationFilter
): Promise<PaginatedNotifications> {
  // ── Build WHERE clause ────────────────────────────────────────────────
  // A notification is visible to a user when any of these holds:
  //   1. Broadcast: contractorId IS NULL AND role IS NULL AND userId IS NULL
  //   2. Targets the user's contractor
  //   3. Targets the user's role
  //   4. Targets the user directly
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Broadcast — always included, no parameters
  conditions.push("(contractorId IS NULL AND role IS NULL AND userId IS NULL)");

  if (filter.contractorId != null) {
    conditions.push("contractorId = ?");
    params.push(filter.contractorId);
  }

  if (filter.role) {
    conditions.push("role = ?");
    params.push(filter.role);
  }

  if (filter.userId != null) {
    conditions.push("userId = ?");
    params.push(filter.userId);
  }

  const whereClause =
    conditions.length > 0
      ? `WHERE (${conditions.join(" OR ")})`
      : "";

  // ── Total count (always unfiltered, just scoped) ─────────────────────
  const countRows = await query(
    `SELECT COUNT(*) AS cnt FROM notifications ${whereClause}`,
    params
  );
  const total = Number((countRows[0] as Record<string, unknown>)?.cnt || 0);

  // ── Data query with optional pagination ──────────────────────────────
  let sql: string;
  let queryParams: unknown[];

  if (
    filter.page != null &&
    filter.limit != null &&
    filter.page > 0 &&
    filter.limit > 0
  ) {
    const offset = (filter.page - 1) * filter.limit;
    sql = `SELECT * FROM notifications ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    queryParams = [...params, filter.limit, offset];
  } else {
    sql = `SELECT * FROM notifications ${whereClause} ORDER BY createdAt DESC`;
    queryParams = params;
  }

  const rows = await query(sql, queryParams);
  return {
    data: rows as unknown as Notification[],
    total,
  };
}

/** Backward-compatible alias: returns all notifications (no filtering). */
export async function getNotifications(): Promise<Notification[]> {
  const result = await getFilteredNotifications({});
  return result.data;
}

export async function readAllNotifications(
  activeContractorId: number | null,
  currentUser: User
): Promise<void> {
  // Mark notifications as read for this user or contractor
  if (activeContractorId) {
    await updateWhere(
      "notifications",
      { read: true },
      "(contractorId = ? OR userId = ?) AND `read` = FALSE",
      [activeContractorId, currentUser.id]
    );
  } else {
    await updateWhere(
      "notifications",
      { read: true },
      "userId = ? AND `read` = FALSE",
      [currentUser.id]
    );
  }
}
