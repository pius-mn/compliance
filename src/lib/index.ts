/**
 * lib barrel — re-exports all database CRUD helpers and utilities.
 *
 * Services and API routes should import from here instead of directly
 * from "./database" for cleaner paths:
 *
 *   ✅ import { getAll, getById } from "../lib";
 *   ❌ import { getAll, getById } from "../lib/database";
 *
 * Internal lib files (auth.ts, permissions.ts, etc.) may still import
 * directly from "./database" to avoid circularity, though using this
 * barrel from within lib/ also works since index.ts re-exports without
 * adding its own logic.
 */
export {
  initDatabase,
  query,
  getConnection,

  // ── Table-level CRUD helpers ─────────────────────────────────────────
  getAll,
  getById,
  getWhere,
  insert,
  update,
  updateWhere,
  remove,
  removeWhere,
  count,
  // ── Transaction support ──────────────────────────────────────────────
  runTransaction,
  // ── Settings ─────────────────────────────────────────────────────────
  getSetting,
  setSetting,
} from "./database";
