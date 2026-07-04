import { initDatabase, query } from "./mysql";

/**
 * Migration: "Pending Branch Approval" → "Pending Contractor Approval"
 *
 * Updates any documents, compliance flags, or other records that
 * still use the old "Pending Branch Approval" status string.
 */
async function migrateStatus() {
  await initDatabase();

  // 1. Documents table
  const docResult = await query(
    `UPDATE documents SET status = ? WHERE status = ?`,
    ["Pending Contractor Approval", "Pending Branch Approval"]
  );
  console.log(`Documents updated: ${(docResult as unknown as { affectedRows?: number })?.affectedRows || 0}`);

  // 2. Audit logs (check for any references in details)
  const auditResult = await query(
    `UPDATE auditLogs SET details = REPLACE(details, ?, ?) WHERE details LIKE ?`,
    ["Pending Branch Approval", "Pending Contractor Approval", "%Pending Branch Approval%"]
  );
  console.log(`Audit log entries updated: ${(auditResult as unknown as { affectedRows?: number })?.affectedRows || 0}`);

  // 3. Notifications (check for any references in messages)
  const notifResult = await query(
    `UPDATE notifications SET message = REPLACE(message, ?, ?) WHERE message LIKE ?`,
    ["Pending Branch Approval", "Pending Contractor Approval", "%Pending Branch Approval%"]
  );
  console.log(`Notifications updated: ${(notifResult as unknown as { affectedRows?: number })?.affectedRows || 0}`);

  console.log("Migration complete: 'Pending Branch Approval' → 'Pending Contractor Approval'");
  process.exit(0);
}

migrateStatus().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
