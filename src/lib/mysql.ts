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
      weight DOUBLE NOT NULL,
      dependencies JSON NOT NULL,
      prerequisites JSON NOT NULL,
      clearedPrerequisites JSON NOT NULL,
      clearedDependencies JSON NULL,
      prerequisiteNotes TEXT NULL,
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
      overallEhsScore DOUBLE NOT NULL,
      contractorId INT NULL,
      workRoleIds JSON NULL
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      technicianId INT NOT NULL,
      technicianName TEXT NOT NULL,
      contractorId INT NOT NULL,
      projectId INT NULL,
      type TEXT NOT NULL,
      documentTypeId INT NULL,
      fileName TEXT NOT NULL,
      uploadDate TEXT NOT NULL,
      status TEXT NOT NULL,
      contractorApproverId INT NULL,
      centralApproverId INT NULL,
      approvalChainComments JSON NOT NULL,
      complianceResult JSON NULL,
      summary TEXT NULL,
      extractedData JSON NULL,
      flaggedIssues JSON NULL,
      previousVersionId INT NULL,
      expiryDate TEXT NULL
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
  await p.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      userId INT NULL,
      role TEXT NULL,
      contractorId INT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      \`read\` BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
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
  // --- Migrate existing databases from branchId → contractorId ---
  // These ALTER TABLE statements are safe to run on fresh installs (columns
  // already have the new names) because CHANGE COLUMN only acts on columns
  // that exist with the old name.
  const migrations = [
    `ALTER TABLE users CHANGE COLUMN branchId contractorId INT NULL`,
    `ALTER TABLE projects DROP COLUMN branchId`,
    `ALTER TABLE projects MODIFY COLUMN contractorId INT NOT NULL`,
    `ALTER TABLE documents CHANGE COLUMN branchId contractorId INT NOT NULL`,
    `ALTER TABLE documents CHANGE COLUMN branchApproverId contractorApproverId INT NULL`,
    `ALTER TABLE auditLogs CHANGE COLUMN branchId contractorId INT NULL`,
    `ALTER TABLE notifications CHANGE COLUMN branchId contractorId INT NULL`,
    `ALTER TABLE sitePhotos CHANGE COLUMN branchId contractorId INT NOT NULL`,
  ];
  for (const sql of migrations) {
    try {
      await p.query(sql);
    } catch {
      // Column already renamed or doesn't exist — safe to ignore
    }
  }

  // --- Migrate existing id columns from VARCHAR(255) to INT AUTO_INCREMENT ---
  // These are safe to run on fresh installs because MODIFY COLUMN only acts
  // on columns that exist with the old type.
  const idMigrations = [
    `ALTER TABLE users MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE contractors MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE projects MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE milestones MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE technicians MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE documents MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE auditLogs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE notifications MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE workRoles MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE documentTypes MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE complianceFlags MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
    `ALTER TABLE sitePhotos MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`,
  ];
  // Also migrate foreign key columns from VARCHAR(255) to INT
  const fkMigrations = [
    `ALTER TABLE users MODIFY COLUMN contractorId INT NULL`,
    `ALTER TABLE projects MODIFY COLUMN contractorId INT NOT NULL`,
    `ALTER TABLE projects MODIFY COLUMN projectLeadId INT NULL`,
    `ALTER TABLE projects MODIFY COLUMN ehsOfficerId INT NULL`,
    `ALTER TABLE milestones MODIFY COLUMN projectId INT NOT NULL`,
    `ALTER TABLE technicians MODIFY COLUMN userId INT NOT NULL`,
    `ALTER TABLE technicians MODIFY COLUMN contractorId INT NULL`,
    `ALTER TABLE documents MODIFY COLUMN technicianId INT NOT NULL`,
    `ALTER TABLE documents MODIFY COLUMN contractorId INT NOT NULL`,
    `ALTER TABLE documents MODIFY COLUMN projectId INT NULL`,
    `ALTER TABLE documents MODIFY COLUMN documentTypeId INT NULL`,
    `ALTER TABLE documents MODIFY COLUMN contractorApproverId INT NULL`,
    `ALTER TABLE documents MODIFY COLUMN centralApproverId INT NULL`,
    `ALTER TABLE documents MODIFY COLUMN previousVersionId INT NULL`,
    `ALTER TABLE auditLogs MODIFY COLUMN userId INT NULL`,
    `ALTER TABLE auditLogs MODIFY COLUMN contractorId INT NULL`,
    `ALTER TABLE notifications MODIFY COLUMN userId INT NULL`,
    `ALTER TABLE notifications MODIFY COLUMN contractorId INT NULL`,
    `ALTER TABLE complianceFlags MODIFY COLUMN targetId INT NOT NULL`,
    `ALTER TABLE sitePhotos MODIFY COLUMN projectId INT NOT NULL`,
    `ALTER TABLE sitePhotos MODIFY COLUMN uploadedByUserId INT NOT NULL`,
    `ALTER TABLE sitePhotos MODIFY COLUMN contractorId INT NOT NULL`,
    `ALTER TABLE contractors MODIFY COLUMN ehsOfficerId INT NULL`,
    `ALTER TABLE contractors MODIFY COLUMN managerId INT NULL`,
  ];
  for (const sql of [...idMigrations, ...fkMigrations]) {
    try {
      await p.query(sql);
    } catch {
      // Column already migrated or doesn't exist — safe to ignore
    }
  }

  // --- Rename legacy 'branches' table to 'contractors' ---
  // The old branches table predates the contractors schema. Uses information_schema
  // to check existence since MySQL doesn't support IF EXISTS on RENAME TABLE.
  try {
    const [rows] = await p.query(`SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'branches'`);
    const hasBranches = Number((rows as Record<string, unknown>[])[0]?.cnt ?? 0) > 0;
    if (hasBranches) {
      await p.query(`RENAME TABLE branches TO contractors`);
    }
  } catch {
    // information_schema query failed — skip
  }
  // Add any columns that the legacy branches table might be missing
  const contractorColumns: Record<string, string> = {
    contactPerson: "''",
    email: "''",
    phone: "''",
    status: "'Active'",
  };
  for (const [col, defaultVal] of Object.entries(contractorColumns)) {
    try {
      await p.query(`ALTER TABLE contractors ADD COLUMN \`${col}\` TEXT NOT NULL DEFAULT ${defaultVal}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }
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
