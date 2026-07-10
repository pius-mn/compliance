import { runComplianceScan } from "../services/compliance_engine";
import { queryEnrichedDocuments } from "../services/ehs";
import { getTechniciansForCompliance } from "../services/technicians";
import { getAll, insert, update, query } from "./database";
import { emitSSE } from "./sse";
import { Role, ComplianceFlag, Project, TechnicianProfile } from "../types";

function sendEmailNotification(to: string, subject: string, body: string) {
  console.log(`[Email Placeholder] To: ${to}, Subject: ${subject}, Body: ${body}`);
}

async function notifyContractorSafetyLeads(contractorId: number | null, subject: string, body: string) {
  if (!contractorId) return;
  const users = await getAll<Record<string, unknown>>("users");
  const safetyLeads = users.filter((u) => (u.contractorId as number) === contractorId && (u.role as string) === Role.ContractorEHSOfficer);
  safetyLeads.forEach((lead) => sendEmailNotification(lead.email as string, subject, body));
}

async function getFlagContractorId(flag: ComplianceFlag): Promise<number | null> {
  const [projects, enrichedDocs, technicians] = await Promise.all([
    getAll<Record<string, unknown>>("projects"),
    queryEnrichedDocuments(),
    getAll<Record<string, unknown>>("technicians"),
  ]);
  const documents = enrichedDocs as unknown as Record<string, unknown>[];
  if (flag.targetType === "project") {
    const project = projects.find((p) => (p.id as number) === flag.targetId);
    return project ? (project.contractorId as number | null) : null;
  } else if (flag.targetType === "document") {
    const doc = documents.find((d) => (d.id as number) === flag.targetId);
    return doc ? (doc.contractorId as number | null) : null;
  } else if (flag.targetType === "technician") {
    const tech = technicians.find((t) => (t.id as number) === flag.targetId);
    if (!tech) return null;
    return (tech.contractorId as number | null) || null;
  }
  return null;
}

async function applyScanResults(newFlags: ComplianceFlag[], updatedFlags: ComplianceFlag[], isStartup: boolean): Promise<boolean> {
  if (newFlags.length > 0) {
    for (const f of newFlags) {
      await insert("complianceFlags", f as unknown as Record<string, unknown>);
      
      if (f.severity === "High") {
        const contractorId = await getFlagContractorId(f);
        if (contractorId) {
          notifyContractorSafetyLeads(contractorId, "🚨 High Severity Compliance Flag Generated", 
            `${f.severity} severity ${f.standard} violation on ${f.targetType} "${f.targetName}": ${f.description}`);
        }
      }

      await insert("notifications", {
        userId: null,
        role: null,
        contractorId: null,
        title: `${isStartup ? "Startup Compliance Warning" : "Compliance Alert"}: ${f.ruleName}`,
        message: f.description,
        type: f.severity === "High" ? "danger" : "warning",
        createdAt: new Date().toISOString(),
        read: false
      });

      if (!isStartup) {
        await insert("auditLogs", {
          userId: 0,
          userName: "Compliance Engine",
          userRole: "Automated Service",
          action: "Regulatory Non-Compliance Flagged",
          category: "EHS Compliance",
          timestamp: new Date().toISOString(),
          details: `${f.severity} severity ${f.standard} violation on ${f.targetType} "${f.targetName}": ${f.description}`,
          contractorId: null
        });
      }
    }
  }

  if (updatedFlags.length > 0) {
    for (const uf of updatedFlags) {
      await update("complianceFlags", uf.id, {
        status: uf.status,
        resolvedAt: uf.resolvedAt,
        resolutionComments: uf.resolutionComments
      });
    }
  }

  return newFlags.length > 0 || updatedFlags.length > 0;
}

/** Parse the assignedTechnicianIds JSON column that query() returns as raw string. */
function parseAssignedTechIds(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    ...r,
    assignedTechnicianIds:
      typeof r.assignedTechnicianIds === "string"
        ? JSON.parse(r.assignedTechnicianIds as string)
        : r.assignedTechnicianIds,
  }));
}

let scannerStarted = false;

export async function startComplianceScanner() {
  if (scannerStarted) return;
  scannerStarted = true;

  try {
    // ── Targeted column projections for the compliance scanner ────────
    // Each getAll() call does SELECT * which transfers every column
    // (including TEXT/JOB columns never examined by the engine).
    // These queries project only the columns actually referenced in
    // runComplianceScan() and applyScanResults().
    const [rawProjects, techs, existingFlags, enrichedDocs] = await Promise.all([
      query(`
        SELECT id, name, status, endDate, contractorId,
               assignedTechnicianIds, description
        FROM projects
      `),
      getTechniciansForCompliance(),
      query(`
        SELECT id, targetId, targetType, targetName, standard,
               ruleName, severity, status, description, flaggedAt,
               resolvedAt, resolutionComments
        FROM complianceFlags
      `),
      queryEnrichedDocuments(),
    ]);
    const projects = parseAssignedTechIds(rawProjects);

    const { newFlags, updatedFlags } = runComplianceScan(
      projects as unknown as Project[],
      enrichedDocs,
      techs as unknown as TechnicianProfile[],
      existingFlags as unknown as ComplianceFlag[]
    );

    const updated = await applyScanResults(newFlags, updatedFlags, true);
    
    if (updated) {
      const updatedFlags_now = await query(
        "SELECT id, status FROM complianceFlags"
      );
      console.log(`[Compliance Engine] Startup compliance sweep done. Active warnings: ${(updatedFlags_now as unknown as ComplianceFlag[]).filter((f: ComplianceFlag) => f.status === "Active").length}`);
    }    } catch (err) {
      console.error("[Compliance Engine] Startup sweep failure:", err);
  }

  setInterval(async () => {
    try {
      // ── Targeted column projections (same as startup) ───────────────
      const [rawProjects, techs, existingFlags, enrichedDocs] = await Promise.all([
        query(`
          SELECT id, name, status, endDate, contractorId,
                 assignedTechnicianIds, description
          FROM projects
        `),
        getTechniciansForCompliance(),
        query(`
          SELECT id, targetId, targetType, targetName, standard,
                 ruleName, severity, status, description, flaggedAt,
                 resolvedAt, resolutionComments
          FROM complianceFlags
        `),
        queryEnrichedDocuments(),
      ]);
      const projects = parseAssignedTechIds(rawProjects);

      const { newFlags, updatedFlags } = runComplianceScan(
        projects as unknown as Project[],
        enrichedDocs,
        techs as unknown as TechnicianProfile[],
        existingFlags as unknown as ComplianceFlag[]
      );

      const updated = await applyScanResults(newFlags, updatedFlags, false);
      if (updated) {
        try {
          emitSSE("compliance_update", { newFlags, updatedFlags });
        } catch {
          // SSE module not loaded or active yet
        }
      }
    } catch (e) {
      console.error("[Compliance Engine] Periodic scanning failure:", e);
    }
  }, 30000);
}
