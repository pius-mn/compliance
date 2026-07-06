import "dotenv/config";
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "ehs_portal",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

// ─── Migration system ────────────────────────────────────────────────────────
//
// Each migration is a named, idempotent step that runs exactly once (tracked
// in the `_migrations` table).  Schema changes, column renames, data backfills,
// and any other DDL/DML that should only execute once belong here.
//
// Migrations run in array order during `initDatabase()`.  Add new entries at
// the *end* of MIGRATIONS — never insert, delete, or reorder an existing one.

interface Migration {
  name: string;
  description: string;
  /** One or more SQL statements to execute as part of this migration. */
  sql?: string[];
  /**
   * Alternative function-based migration for logic that can't be expressed
   * as simple SQL (e.g. conditional checks before running DDL).  Only one
   * of `sql` or `fn` should be provided.
   */
  fn?: (p: mysql.Pool) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: "rename_branch_to_contractor",
    description: "Rename branchId/branchApproverId columns to contractorId/contractorApproverId",
    sql: [
      "ALTER TABLE users CHANGE COLUMN branchId contractorId INT NULL",
      "ALTER TABLE projects DROP COLUMN branchId",
      "ALTER TABLE projects MODIFY COLUMN contractorId INT NOT NULL",
      "ALTER TABLE documents CHANGE COLUMN branchId contractorId INT NOT NULL",
      "ALTER TABLE documents CHANGE COLUMN branchApproverId contractorApproverId INT NULL",
      "ALTER TABLE auditLogs CHANGE COLUMN branchId contractorId INT NULL",
      "ALTER TABLE notifications CHANGE COLUMN branchId contractorId INT NULL",
      "ALTER TABLE sitePhotos CHANGE COLUMN branchId contractorId INT NOT NULL",
    ],
  },
  {
    name: "migrate_ids_to_int",
    description: "Migrate primary-key id columns from VARCHAR(255) to INT AUTO_INCREMENT",
    sql: [
      "ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE contractors MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE projects MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE milestones MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE technicians MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE documents MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE auditLogs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE notifications MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE workRoles MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE documentTypes MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE complianceFlags MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
      "ALTER TABLE sitePhotos MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT",
    ],
  },
  {
    name: "migrate_fk_to_int",
    description: "Migrate foreign-key columns from VARCHAR(255) to INT",
    sql: [
      "ALTER TABLE users MODIFY COLUMN contractorId INT NULL",
      "ALTER TABLE projects MODIFY COLUMN contractorId INT NOT NULL",
      "ALTER TABLE projects MODIFY COLUMN projectLeadId INT NULL",
      "ALTER TABLE projects MODIFY COLUMN ehsOfficerId INT NULL",
      "ALTER TABLE milestones MODIFY COLUMN projectId INT NOT NULL",
      "ALTER TABLE technicians MODIFY COLUMN userId INT NOT NULL",
      "ALTER TABLE technicians MODIFY COLUMN contractorId INT NULL",
      "ALTER TABLE documents MODIFY COLUMN technicianId INT NOT NULL",
      "ALTER TABLE documents MODIFY COLUMN contractorId INT NOT NULL",
      "ALTER TABLE documents MODIFY COLUMN projectId INT NULL",
      "ALTER TABLE documents MODIFY COLUMN documentTypeId INT NULL",
      "ALTER TABLE documents MODIFY COLUMN contractorApproverId INT NULL",
      "ALTER TABLE documents MODIFY COLUMN centralApproverId INT NULL",
      "ALTER TABLE documents MODIFY COLUMN previousVersionId INT NULL",
      "ALTER TABLE auditLogs MODIFY COLUMN userId INT NULL",
      "ALTER TABLE auditLogs MODIFY COLUMN contractorId INT NULL",
      "ALTER TABLE notifications MODIFY COLUMN userId INT NULL",
      "ALTER TABLE notifications MODIFY COLUMN contractorId INT NULL",
      "ALTER TABLE complianceFlags MODIFY COLUMN targetId INT NOT NULL",
      "ALTER TABLE sitePhotos MODIFY COLUMN projectId INT NOT NULL",
      "ALTER TABLE sitePhotos MODIFY COLUMN uploadedByUserId INT NOT NULL",
      "ALTER TABLE sitePhotos MODIFY COLUMN contractorId INT NOT NULL",
      "ALTER TABLE contractors MODIFY COLUMN ehsOfficerId INT NULL",
      "ALTER TABLE contractors MODIFY COLUMN managerId INT NULL",
    ],
  },
  {
    name: "rename_branches_table",
    description: "Rename legacy branches table to contractors and add missing columns",
    fn: async (p: mysql.Pool) => {
      // Only attempt rename if the legacy `branches` table still exists
      const [rows] = await p.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'branches'"
      ) as [Record<string, unknown>[], unknown];
      const hasBranches = Number((rows[0] as Record<string, unknown>)?.cnt ?? 0) > 0;
      if (hasBranches) {
        await p.query("RENAME TABLE branches TO contractors");
      }
      // These ADD COLUMN statements are safe to re-run (no-op if column exists)
      const addColumns = [
        "ALTER TABLE contractors ADD COLUMN contactPerson TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE contractors ADD COLUMN email TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE contractors ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE contractors ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'",
      ];
      for (const stmt of addColumns) {
        try {
          await p.query(stmt);
        } catch {
          // Column already exists — safe to ignore
        }
      }
    },
  },
  {
    name: "add_compliance_columns",
    description: "Add complianceApprovedCount/complianceTotalRequired to technicians and drop stored overallEhsScore",
    sql: [
      "ALTER TABLE technicians ADD COLUMN complianceApprovedCount INT NOT NULL DEFAULT 0",
      "ALTER TABLE technicians ADD COLUMN complianceTotalRequired INT NOT NULL DEFAULT 0",
      "ALTER TABLE technicians DROP COLUMN overallEhsScore",
    ],
  },
  {
    name: "remove_compliance_count_columns",
    description: "Remove complianceApprovedCount and complianceTotalRequired columns from technicians (score is now computed on-the-fly)",
    sql: [
      "ALTER TABLE technicians DROP COLUMN complianceApprovedCount",
      "ALTER TABLE technicians DROP COLUMN complianceTotalRequired",
    ],
  },
  {
    name: "update_status_strings",
    description: "Replace legacy 'Pending Branch Approval' status with 'Pending Contractor Approval'",
    sql: [
      "UPDATE documents SET status = 'Pending Contractor Approval' WHERE status = 'Pending Branch Approval'",
      "UPDATE auditLogs SET details = REPLACE(details, 'Pending Branch Approval', 'Pending Contractor Approval') WHERE details LIKE '%Pending Branch Approval%'",
      "UPDATE notifications SET message = REPLACE(message, 'Pending Branch Approval', 'Pending Contractor Approval') WHERE message LIKE '%Pending Branch Approval%'",
    ],
  },
  {
    name: "remove_document_columns",
    description: "Drop projectId, approvalChainComments, complianceResult, summary, extractedData, flaggedIssues, previousVersionId from documents",
    sql: [
      "ALTER TABLE documents DROP COLUMN projectId",
      "ALTER TABLE documents DROP COLUMN approvalChainComments",
      "ALTER TABLE documents DROP COLUMN complianceResult",
      "ALTER TABLE documents DROP COLUMN summary",
      "ALTER TABLE documents DROP COLUMN extractedData",
      "ALTER TABLE documents DROP COLUMN flaggedIssues",
      "ALTER TABLE documents DROP COLUMN previousVersionId",
    ],
  },
  {
    name: "refactor_documents_columns",
    description: "Drop technicianName and type, replace status with rejected boolean, change expiryDate from TEXT to DATE",
    sql: [
      "ALTER TABLE documents DROP COLUMN technicianName",
      "ALTER TABLE documents DROP COLUMN type",
      "ALTER TABLE documents DROP COLUMN status",
      "ALTER TABLE documents ADD COLUMN rejected BOOLEAN NOT NULL DEFAULT FALSE AFTER uploadDate",
      "ALTER TABLE documents MODIFY COLUMN expiryDate DATE NULL",
    ],
  },
  {
    name: "add_document_file_path",
    description: "Add file_path column to documents table for filesystem file storage",
    sql: [
      "ALTER TABLE documents ADD COLUMN file_path TEXT NULL AFTER expiryDate",
    ],
  },
  {
    name: "drop_milestone_unused_columns",
    description: "Drop weight and prerequisiteNotes columns from milestones (never read/displayed, only written)",
    sql: [
      "ALTER TABLE milestones DROP COLUMN weight",
      "ALTER TABLE milestones DROP COLUMN prerequisiteNotes",
    ],
  },
  {
    name: "drop_milestone_prerequisites_columns",
    description: "Drop prerequisites and clearedPrerequisites JSON columns from milestones",
    sql: [
      "ALTER TABLE milestones DROP COLUMN prerequisites",
      "ALTER TABLE milestones DROP COLUMN clearedPrerequisites",
    ],
  },
  {
    name: "seed_ai_score_threshold",
    description: "Seed the default AI score threshold (50) into appSettings",
    sql: [
      "INSERT INTO appSettings (settingKey, settingValue, updatedAt) SELECT 'aiScoreThreshold', '50', NOW() WHERE NOT EXISTS (SELECT 1 FROM appSettings WHERE settingKey = 'aiScoreThreshold')",
    ],
  },
];

async function runMigrations(p: mysql.Pool): Promise<void> {
  // Create the tracking table if it doesn't exist
  await p.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      durationMs INT NULL
    )
  `);

  // Fetch already-applied migrations
  const [appliedRows] = await p.query(
    "SELECT name FROM _migrations"
  ) as [Record<string, unknown>[], unknown];
  const applied = new Set((appliedRows as { name: string }[]).map((r) => r.name));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;

    const start = Date.now();
    let success = false;

    try {
      if (migration.sql) {
        for (const stmt of migration.sql) {
          try {
            await p.query(stmt);
          } catch {
            // Individual SQL statements may fail on fresh installs (e.g. CHANGE
            // COLUMN when the old column name was never used).  We skip the error
            // and continue so the migration is still recorded as applied.
            console.log(`  ↪ [SKIP] ${stmt.slice(0, 100)}…`);
          }
        }
      } else if (migration.fn) {
        await migration.fn(p);
      }
      success = true;
    } catch (err) {
      console.error(`[Migration FAILED] ${migration.name}:`, err);
      // Do NOT record failed migrations so they retry on next startup
      continue;
    }

    const durationMs = Date.now() - start;
    await p.query(
      "INSERT INTO _migrations (name, description, durationMs) VALUES (?, ?, ?)",
      [migration.name, migration.description, durationMs]
    );

    if (success) {
      console.log(`[Migration OK] ${migration.name} — ${durationMs}ms`);
    }
  }
}

// ─── Schema bootstrap ────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      contractorId INT NULL,
      isCentral BOOLEAN NOT NULL DEFAULT FALSE,
      username TEXT NULL,
      password TEXT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS contractors (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      location TEXT NOT NULL,
      ehsOfficerId INT NULL,
      managerId INT NULL,
      contactPerson TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active'
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      contractorId INT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      budget DOUBLE NOT NULL,
      milestonesCount JSON NOT NULL,
      rolloutDistance DOUBLE NULL,
      assignedTechnicianIds JSON NULL,
      projectLeadId INT NULL,
      ehsOfficerId INT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS milestones (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      projectId INT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      dependencies JSON NOT NULL,
      clearedDependencies JSON NULL,
      statusComments TEXT NULL,
      completedAt TEXT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      userId INT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      specialization TEXT NOT NULL,
      status TEXT NOT NULL,
      lastEhsAuditDate TEXT NULL,
      contractorId INT NULL,
      workRoleIds JSON NULL
    )
  `);
  // ─── DO NOT RE-ADD REMOVED COLUMNS ──────────────────────────────────────
  // projectId, approvalChainComments, complianceResult, summary, extractedData,
  // flaggedIssues, previousVersionId were permanently deleted. See migration
  // `remove_document_columns` and lint rules in eslint.config.mjs.
  // NOTE: approvalChainComments, complianceResult, extractedData, flaggedIssues,
  // and previousVersionId are lint-flagged (Identifier ban). projectId and
  // summary are guarded by comments only (too common to blanket-ban).
  // ─── DO NOT RE-ADD REMOVED COLUMNS ──────────────────────────────────────
  // technicianName, type, status were replaced. technicianName and type are
  // now resolved via JOIN at query time. status was replaced by rejected
  // (boolean). expiryDate was changed from TEXT to DATE.
  await p.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      technicianId INT NOT NULL,
      contractorId INT NOT NULL,
      documentTypeId INT NULL,
      fileName TEXT NOT NULL,
      uploadDate TEXT NOT NULL,
      rejected BOOLEAN NOT NULL DEFAULT FALSE,
      contractorApproverId INT NULL,
      centralApproverId INT NULL,
      expiryDate DATE NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS auditLogs (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      userId INT NULL,
      userName TEXT NOT NULL,
      userRole TEXT NOT NULL,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT NOT NULL,
      contractorId INT NULL
    )
  `);
  await p.query(
    "CREATE TABLE IF NOT EXISTS notifications (" +
    "  id INT NOT NULL PRIMARY KEY AUTO_INCREMENT," +
    "  userId INT NULL," +
    "  role TEXT NULL," +
    "  contractorId INT NULL," +
    "  title TEXT NOT NULL," +
    "  message TEXT NOT NULL," +
    "  type TEXT NOT NULL," +
    "  createdAt TEXT NOT NULL," +
    "  `read` BOOLEAN NOT NULL DEFAULT FALSE" +
    ")"
  );
  await p.query(`
    CREATE TABLE IF NOT EXISTS workRoles (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name TEXT NOT NULL,
      documentTypeIds JSON NOT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS documentTypes (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name TEXT NOT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS complianceFlags (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      targetId INT NOT NULL,
      targetType TEXT NOT NULL,
      targetName TEXT NOT NULL,
      standard TEXT NOT NULL,
      ruleName TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      flaggedAt TEXT NOT NULL,
      resolvedAt TEXT NULL,
      resolutionComments TEXT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS sitePhotos (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      projectId INT NOT NULL,
      uploadedByUserId INT NOT NULL,
      uploadedByUserName TEXT NOT NULL,
      contractorId INT NOT NULL,
      photoData TEXT NOT NULL,
      uploadDate TEXT NOT NULL,
      description TEXT NOT NULL,
      complianceNotes TEXT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS dailyNotes (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      projectId INT NOT NULL,
      date TEXT NOT NULL,
      hazard TEXT NOT NULL,
      solution TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      aiScore DOUBLE NULL,
      aiMissedItems JSON NULL,
      aiAnalyzedAt TEXT NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS appSettings (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      settingKey TEXT NOT NULL,
      settingValue TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Run tracked migrations
  await runMigrations(p);
}

export async function query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows as Record<string, unknown>[];
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  const p = getPool();
  return p.getConnection();
}
