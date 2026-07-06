import { initDatabase, query, getConnection } from "./mysql";
import type mysql from "mysql2/promise";

export { initDatabase, query, getConnection };

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
}

/** Quote a MySQL identifier (table / column name). */
function qi(name: string): string {
  return "`" + name.replace(/`/g, "``") + "`";
}

/**
 * Set of known JSON columns (table.column) that should be parsed from
 * their string representation into JS objects/arrays.
 *
 * Non-JSON columns (e.g. sitePhotos.description) may contain strings
 * that look like JSON but are handled by the application layer and
 * must NOT be pre-parsed here.
 */
const JSON_COLUMNS = new Set([
  "projects.milestonesCount",
  "projects.assignedTechnicianIds",
  "milestones.dependencies",
  "milestones.clearedDependencies",
  "technicians.workRoleIds",
  "workRoles.documentTypeIds",
  "dailyNotes.aiMissedItems",
]);

/**
 * Attempt to parse a MySQL JSON column value (returned as a string by
 * mysql2) back into a JS object/array.  Only attempts parse on values
 * that look like JSON arrays or objects to avoid mangling plain text.
 */
function parseJsonValue(val: unknown, table: string, column: string): unknown {
  if (!JSON_COLUMNS.has(`${table}.${column}`)) return val;
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!((trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}")))) {
    return val;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null ? parsed : val;
  } catch {
    return val;
  }
}

/** Parse every JSON-looking string value in a row. */
function parseRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    parsed[key] = parseJsonValue(val, table, key);
  }
  return parsed;
}

/**
 * Serialise a value before sending it to MySQL.
 *
 * Arrays and plain objects are serialised with JSON.stringify because
 * non-JSON columns in this schema never receive them, and for JSON
 * columns MySQL will store them as native JSON values rather than
 * quoted string literals.
 */
function prepareValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val) || (typeof val === "object" && val.constructor === Object)) {
    return JSON.stringify(val);
  }
  return val;
}

/** Parse all rows from a raw query result through JSON column parsing. */
function parseRows(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return (rows || []).map(r => parseRow(table, r));
}

// ─── Table-level CRUD helpers ────────────────────────────────────────────────
// Each function operates on a single table with targeted SQL queries.

/**
 * Get all rows from a table.
 * JSON columns are automatically parsed into objects/arrays.
 */
export async function getAll<T = Record<string, unknown>>(table: string): Promise<T[]> {
  await ensureInitialized();
  const rows: Record<string, unknown>[] = await query(`SELECT * FROM ${qi(table)}`);
  return parseRows(table, rows) as T[];
}

/**
 * Get a single row by its id column.
 * Returns null if not found.
 */
export async function getById<T = Record<string, unknown>>(table: string, id: number): Promise<T | null> {
  await ensureInitialized();
  const rows: Record<string, unknown>[] = await query(`SELECT * FROM ${qi(table)} WHERE id = ?`, [id]);
  if (rows.length === 0) return null;
  return parseRows(table, rows)[0] as T;
}

/**
 * Get rows matching arbitrary WHERE conditions.
 *
 * @example
 *   await getWhere("users", "contractorId = ? AND role = ?", [5, "Field Technician"])
 */
export async function getWhere<T = Record<string, unknown>>(table: string, where: string, params: unknown[] = []): Promise<T[]> {
  await ensureInitialized();
  const rows: Record<string, unknown>[] = await query(`SELECT * FROM ${qi(table)} WHERE ${where}`, params);
  return parseRows(table, rows) as T[];
}

/**
 * Insert a single row and return the auto-generated id.
 * Objects/arrays in the data are automatically JSON-stringified.
 */
export async function insert<T extends Record<string, unknown>>(table: string, data: T): Promise<number> {
  await ensureInitialized();
  const keys = Object.keys(data) as (keyof T & string)[];
  const columns = keys.map(qi).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map(k => prepareValue(data[k]));
  const sql = `INSERT INTO ${qi(table)} (${columns}) VALUES (${placeholders})`;
  const result = await query(sql, values) as unknown as { insertId: number };
  return result.insertId;
}

/**
 * Update a row identified by its id.
 * Only the provided keys in `data` are updated.
 */
export async function update<T extends Record<string, unknown>>(table: string, id: number, data: T): Promise<void> {
  await ensureInitialized();
  const keys = Object.keys(data) as (keyof T & string)[];
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${qi(k)} = ?`).join(", ");
  const values = [...keys.map(k => prepareValue(data[k])), id];
  await query(`UPDATE ${qi(table)} SET ${setClause} WHERE id = ?`, values);
}

/**
 * Update rows matching arbitrary WHERE conditions.
 */
export async function updateWhere<T extends Record<string, unknown>>(table: string, data: T, where: string, params: unknown[] = []): Promise<void> {
  await ensureInitialized();
  const keys = Object.keys(data) as (keyof T & string)[];
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${qi(k)} = ?`).join(", ");
  const values = [...keys.map(k => prepareValue(data[k])), ...params];
  await query(`UPDATE ${qi(table)} SET ${setClause} WHERE ${where}`, values);
}

/**
 * Delete a row by its id.
 */
export async function remove(table: string, id: number): Promise<void> {
  await ensureInitialized();
  await query(`DELETE FROM ${qi(table)} WHERE id = ?`, [id]);
}

/**
 * Delete rows matching arbitrary WHERE conditions.
 */
export async function removeWhere(table: string, where: string, params: unknown[] = []): Promise<void> {
  await ensureInitialized();
  await query(`DELETE FROM ${qi(table)} WHERE ${where}`, params);
}

/**
 * Get count of rows in a table (optionally filtered by WHERE).
 */
export async function count(table: string, where?: string, params: unknown[] = []): Promise<number> {
  await ensureInitialized();
  const sql = where
    ? `SELECT COUNT(*) AS cnt FROM ${qi(table)} WHERE ${where}`
    : `SELECT COUNT(*) AS cnt FROM ${qi(table)}`;
  const rows = await query(sql, where ? params : []) as Record<string, unknown>[];
  return Number((rows[0] as Record<string, unknown>)?.cnt || 0);
}

// ─── Settings helpers ───────────────────────────────────────────────────────

/**
 * Get a setting value by key from the appSettings table.
 * Returns null if the key doesn't exist.
 */
export async function getSetting(key: string): Promise<string | null> {
  await ensureInitialized();
  const rows = await query("SELECT settingValue FROM appSettings WHERE settingKey = ? LIMIT 1", [key]);
  if (rows.length === 0) return null;
  return (rows[0] as Record<string, unknown>).settingValue as string || null;
}

/**
 * Set a setting value by key in the appSettings table (upsert).
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await ensureInitialized();
  const now = new Date().toISOString();
  const existing = await query(
    "SELECT id FROM appSettings WHERE settingKey = ? LIMIT 1",
    [key]
  );
  if (existing.length > 0) {
    await updateWhere("appSettings", { settingValue: value, updatedAt: now }, "settingKey = ?", [key]);
  } else {
    await insert("appSettings", { settingKey: key, settingValue: value, updatedAt: now });
  }
}

// ─── Transaction helper ─────────────────────────────────────────────────────

/**
 * Execute a callback within a MySQL transaction.
 * If the callback throws, the transaction is rolled back.
 * Otherwise, it is committed.
 *
 * @example
 *   await runTransaction(async (tx) => {
 *     await tx.query("UPDATE users SET name = ? WHERE id = ?", ["new name", 1]);
 *     await tx.query("INSERT INTO auditLogs ...");
 *   });
 */
export async function runTransaction<T>(
  fn: (tx: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  await ensureInitialized();
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
