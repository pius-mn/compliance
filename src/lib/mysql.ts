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
  {
    name: "add_more_indexes",
    description: "Add additional database indexes for commonly-queried composite patterns missed in the first pass",
    fn: async (p: mysql.Pool) => {
      const indexes = [
        // users(contractorId, role) — used across 3 files for safety lead lookups
        // WHERE contractorId = ? AND role = ?
        { table: "users",        name: "idx_users_contractor_role",     columns: "(contractorId, role(100))" },

        // appSettings(settingKey) — unique lookup for config values
        // WHERE settingKey = ? LIMIT 1
        // Uses UNIQUE to enforce key uniqueness at the DB level
        // CREATE UNIQUE INDEX requires the same information_schema check
        { table: "appSettings",  name: "idx_app_settings_key",         columns: "(settingKey(255))", unique: true },

        // milestones(projectId, status) — composite for completion counting
        // WHERE projectId = ?  (then filter by status = 'Completed')
        { table: "milestones",   name: "idx_milestones_project_status", columns: "(projectId, status(50))" },

        // documents(technicianId, documentTypeId) — composite for duplicate check
        // WHERE technicianId = ? AND documentTypeId = ? AND rejected = FALSE
        { table: "documents",    name: "idx_documents_tech_doc_type",   columns: "(technicianId, documentTypeId)" },

        // auditLogs(category) — used in audit trail filtering
        // WHERE category = ?
        { table: "auditLogs",    name: "idx_audit_logs_category",       columns: "(category(50))" },

        // auditLogs(action) — used in audit trail filtering
        // WHERE action = ?
        { table: "auditLogs",    name: "idx_audit_logs_action",         columns: "(action(100))" },

        // contractors(status) — used for filtering by Active/Suspended/Pending Review
        // WHERE status = ?
        { table: "contractors",  name: "idx_contractors_status",        columns: "(status(50))" },

        // sitePhotos(uploadedByUserId) — used for looking up photos by uploader
        // WHERE uploadedByUserId = ?
        { table: "sitePhotos",   name: "idx_site_photos_uploaded_by",   columns: "(uploadedByUserId)" },

        // complianceFlags(standard) — used in API filtering
        // WHERE standard = ?
        { table: "complianceFlags", name: "idx_compliance_flags_standard", columns: "(standard(50))" },

        // complianceFlags(flaggedAt) — used for trend analysis and date-range queries
        // WHERE flaggedAt > ?
        // Prefix 25 covers the full ISO 8601 timestamp (e.g. "2026-06-14T06:45:33-07:00")
        { table: "complianceFlags", name: "idx_compliance_flags_flagged_at", columns: "(flaggedAt(25))" },
      ];

      for (const idx of indexes) {
        try {
          const [existingIdx] = await p.query(
            `SELECT COUNT(*) AS cnt FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = ?
               AND index_name = ?`,
            [idx.table, idx.name]
          ) as [Record<string, unknown>[], unknown];
          const exists = Number((existingIdx[0] as Record<string, unknown>)?.cnt ?? 0) > 0;

          if (!exists) {
            const create = idx.unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX";
            await p.query(`${create} \`${idx.name}\` ON \`${idx.table}\` ${idx.columns}`);
          }
        } catch (err) {
          console.warn(`  ↪ [INDEX SKIP] ${idx.name} — ${(err as Error).message}`);
        }
      }
    },
  },
  {
    name: "add_foreign_keys_and_indexes",
    description: "Add foreign key constraints and database indexes for referential integrity and query performance",
    fn: async (p: mysql.Pool) => {
      // ── FOREIGN KEY CONSTRAINTS ──────────────────────────────────────────
      // Each constraint is wrapped in try/catch because existing data may
      // contain orphaned references (which will cause the FK to fail).
      // A future data-cleanup pass should remove orphaned rows first.
      const fkStatements = [
        // users
        `ALTER TABLE users ADD CONSTRAINT fk_users_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,

        // technicians
        `ALTER TABLE technicians ADD CONSTRAINT fk_technicians_user
         FOREIGN KEY (userId) REFERENCES users(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE technicians ADD CONSTRAINT fk_technicians_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,

        // projects
        `ALTER TABLE projects ADD CONSTRAINT fk_projects_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE projects ADD CONSTRAINT fk_projects_lead
         FOREIGN KEY (projectLeadId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE projects ADD CONSTRAINT fk_projects_ehs_officer
         FOREIGN KEY (ehsOfficerId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,

        // milestones
        `ALTER TABLE milestones ADD CONSTRAINT fk_milestones_project
         FOREIGN KEY (projectId) REFERENCES projects(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,

        // documents
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_technician
         FOREIGN KEY (technicianId) REFERENCES technicians(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_doc_type
         FOREIGN KEY (documentTypeId) REFERENCES documentTypes(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_contractor_approver
         FOREIGN KEY (contractorApproverId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_central_approver
         FOREIGN KEY (centralApproverId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,

        // auditLogs
        `ALTER TABLE auditLogs ADD CONSTRAINT fk_audit_logs_user
         FOREIGN KEY (userId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE auditLogs ADD CONSTRAINT fk_audit_logs_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,

        // notifications
        `ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
         FOREIGN KEY (userId) REFERENCES users(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE notifications ADD CONSTRAINT fk_notifications_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,

        // sitePhotos
        `ALTER TABLE sitePhotos ADD CONSTRAINT fk_site_photos_project
         FOREIGN KEY (projectId) REFERENCES projects(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE sitePhotos ADD CONSTRAINT fk_site_photos_user
         FOREIGN KEY (uploadedByUserId) REFERENCES users(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE sitePhotos ADD CONSTRAINT fk_site_photos_contractor
         FOREIGN KEY (contractorId) REFERENCES contractors(id)
         ON DELETE RESTRICT ON UPDATE CASCADE`,

        // dailyNotes
        `ALTER TABLE dailyNotes ADD CONSTRAINT fk_daily_notes_project
         FOREIGN KEY (projectId) REFERENCES projects(id)
         ON DELETE CASCADE ON UPDATE CASCADE`,

        // contractors (self-referencing via user FK)
        `ALTER TABLE contractors ADD CONSTRAINT fk_contractors_ehs_officer
         FOREIGN KEY (ehsOfficerId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE contractors ADD CONSTRAINT fk_contractors_manager
         FOREIGN KEY (managerId) REFERENCES users(id)
         ON DELETE SET NULL ON UPDATE CASCADE`,
      ];

      for (const stmt of fkStatements) {
        try {
          await p.query(stmt);
        } catch (err) {
          // FK creation may fail if existing data has orphaned references.
          // Log a warning so operators are aware, but don't block startup.
          const shortName = stmt.match(/ADD CONSTRAINT (\S+)/)?.[1] || "unknown";
          console.warn(`  ↪ [FK SKIP] ${shortName} — ${(err as Error).message}`);
        }
      }

      // ── DATABASE INDEXES ────────────────────────────────────────────────
      // Indexes are added with IF NOT EXISTS (via a check against
      // information_schema) so they are idempotent.
      const indexes = [
        // users
        { table: "users",        name: "idx_users_contractor_id",   columns: "(contractorId)" },
        { table: "users",        name: "idx_users_email",          columns: "(email(255))" },
        { table: "users",        name: "idx_users_role",           columns: "(role(100))" },

        // technicians
        { table: "technicians",  name: "idx_technicians_contractor_id", columns: "(contractorId)" },
        { table: "technicians",  name: "idx_technicians_user_id",       columns: "(userId)" },
        { table: "technicians",  name: "idx_technicians_status",        columns: "(status(50))" },

        // projects
        { table: "projects",     name: "idx_projects_contractor_id", columns: "(contractorId)" },
        { table: "projects",     name: "idx_projects_status",        columns: "(status(50))" },

        // milestones
        { table: "milestones",   name: "idx_milestones_project_id", columns: "(projectId)" },
        { table: "milestones",   name: "idx_milestones_status",     columns: "(status(50))" },

        // documents
        { table: "documents",    name: "idx_documents_technician_id",       columns: "(technicianId)" },
        { table: "documents",    name: "idx_documents_contractor_id",        columns: "(contractorId)" },
        { table: "documents",    name: "idx_documents_document_type_id",     columns: "(documentTypeId)" },
        { table: "documents",    name: "idx_documents_contractor_approver",  columns: "(contractorApproverId)" },
        { table: "documents",    name: "idx_documents_central_approver",     columns: "(centralApproverId)" },
        { table: "documents",    name: "idx_documents_status_lookup",        columns: "(rejected, contractorApproverId, centralApproverId)" },

        // auditLogs
        { table: "auditLogs",    name: "idx_audit_logs_contractor_id", columns: "(contractorId)" },
        { table: "auditLogs",    name: "idx_audit_logs_user_id",        columns: "(userId)" },
        { table: "auditLogs",    name: "idx_audit_logs_timestamp",      columns: "(timestamp(20))" },

        // notifications
        { table: "notifications", name: "idx_notifications_contractor_id", columns: "(contractorId)" },
        { table: "notifications", name: "idx_notifications_user_id",        columns: "(userId)" },
        { table: "notifications", name: "idx_notifications_read",           columns: "(`read`)" },

        // complianceFlags
        { table: "complianceFlags", name: "idx_compliance_flags_target",   columns: "(targetType(50), targetId)" },
        { table: "complianceFlags", name: "idx_compliance_flags_severity", columns: "(severity(20))" },
        { table: "complianceFlags", name: "idx_compliance_flags_status",   columns: "(status(20))" },

        // sitePhotos
        { table: "sitePhotos",   name: "idx_site_photos_project_id", columns: "(projectId)" },

        // dailyNotes
        { table: "dailyNotes",   name: "idx_daily_notes_project_date", columns: "(projectId, date(20))" },

        // contractors
        { table: "contractors",  name: "idx_contractors_ehs_officer_id", columns: "(ehsOfficerId)" },
        { table: "contractors",  name: "idx_contractors_manager_id",      columns: "(managerId)" },
      ];

      for (const idx of indexes) {
        try {
          // Check if the index already exists
          const [existingIdx] = await p.query(
            `SELECT COUNT(*) AS cnt FROM information_schema.statistics
             WHERE table_schema = DATABASE()
               AND table_name = ?
               AND index_name = ?`,
            [idx.table, idx.name]
          ) as [Record<string, unknown>[], unknown];
          const exists = Number((existingIdx[0] as Record<string, unknown>)?.cnt ?? 0) > 0;

          if (!exists) {
            await p.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` ${idx.columns}`);
          }
        } catch (err) {
          console.warn(`  ↪ [INDEX SKIP] ${idx.name} — ${(err as Error).message}`);
        }
      }
    },
  },
  {
    name: "reset_milestones_count_total",
    description: "Set milestonesCount.total to 0 for all existing projects (total is now a client-side constant)",
    sql: [
      "UPDATE projects SET milestonesCount = JSON_SET(milestonesCount, '$.total', 0)",
    ],
  },
  {
    name: "add_document_file_mime_type",
    description: "Add fileMimeType column to documents table so preview components know file type without guessing from extension",
    sql: [
      "ALTER TABLE documents ADD COLUMN fileMimeType TEXT NULL AFTER file_path",
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
