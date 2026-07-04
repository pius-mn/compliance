import { getAll } from "../lib";

export async function getAuditLogs(): Promise<Record<string, unknown>[]> {
  return await getAll<Record<string, unknown>>("auditLogs");
}
