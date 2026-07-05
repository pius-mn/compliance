import { runComplianceScan } from "../services/compliance_engine";
import { enrichDocuments } from "../services/ehs";
import { getTechnicians } from "../services/technicians";
import { getAll, insert, update } from "./database";
import { emitSSE } from "./sse";
import { Role, ComplianceFlag, Project, TechnicianDocument, TechnicianProfile, User } from "../types";

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
  const [projects, documents, technicians] = await Promise.all([
    getAll<Record<string, unknown>>("projects"),
    getAll<Record<string, unknown>>("documents"),
    getAll<Record<string, unknown>>("technicians"),
  ]);
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

let scannerStarted = false;

export async function startComplianceScanner() {
  if (scannerStarted) return;
  scannerStarted = true;

  try {
    const [projects, documents, documentTypes, techs, users, existingFlags] = await Promise.all([
      getAll<Project>("projects"),
      getAll<TechnicianDocument>("documents"),
      getAll<Record<string, unknown>>("documentTypes"),
      getTechnicians(),
      getAll<User>("users"),
      getAll<ComplianceFlag>("complianceFlags"),
    ]);

    const enrichedDocs = await enrichDocuments(
      documents,
      techs as Record<string, unknown>[],
      documentTypes as Record<string, unknown>[],
    );

    const technicians = techs as unknown as TechnicianProfile[];

    const { newFlags, updatedFlags } = runComplianceScan(projects, enrichedDocs, technicians, users, existingFlags);

    const updated = await applyScanResults(newFlags, updatedFlags, true);
    
    if (updated) {
      const updatedFlags_now = await getAll<ComplianceFlag>("complianceFlags");
      console.log(`[Compliance Engine] Startup compliance sweep done. Active warnings: ${updatedFlags_now.filter((f: ComplianceFlag) => f.status === "Active").length}`);
    }    } catch (err) {
      console.error("[Compliance Engine] Startup sweep failure:", err);
  }

  setInterval(async () => {
    try {
      const [projects, documents, documentTypes, techs, users, existingFlags] = await Promise.all([
        getAll<Project>("projects"),
        getAll<TechnicianDocument>("documents"),
        getAll<Record<string, unknown>>("documentTypes"),
        getTechnicians(),
        getAll<User>("users"),
        getAll<ComplianceFlag>("complianceFlags"),
      ]);

      const intervalEnriched = await enrichDocuments(
        documents,
        techs as Record<string, unknown>[],
        documentTypes as Record<string, unknown>[],
      );

      const technicians = techs as unknown as TechnicianProfile[];

      const { newFlags, updatedFlags } = runComplianceScan(projects, intervalEnriched, technicians, users, existingFlags);

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
