import { Project, TechnicianDocument, TechnicianProfile, ComplianceFlag, User } from "../types";
import { getAll, getById, getWhere, insert, update } from "../lib";
import { runComplianceScan } from "./compliance_engine";
import { getTechnicians } from "./technicians";
import { emitSSE } from "../lib/sse";
import { requireRole } from "../lib/permissions";
import { enrichDocuments } from "./ehs";

export async function getComplianceFlags(): Promise<ComplianceFlag[]> {
  return await getAll<ComplianceFlag>("complianceFlags");
}

async function getFlagBranchId(flag: ComplianceFlag, flagProjects: Record<string, unknown>[], flagDocs: Record<string, unknown>[], flagTechs: Record<string, unknown>[]): Promise<number | null> {
  if (flag.targetType === "project") {
    const project = flagProjects.find((p) => p.id === flag.targetId);
    return project ? (project.contractorId as number | null) : null;
  } else if (flag.targetType === "document") {
    const doc = flagDocs.find((d) => d.id === flag.targetId);
    return doc ? (doc.contractorId as number | null) : null;
  } else if (flag.targetType === "technician") {
    const tech = flagTechs.find((t) => t.id === flag.targetId);
    return tech ? ((tech.contractorId as number | null) || null) : null;
  }
  return null;
}

async function notifyContractorSafetyLeads(contractorId: number | null, title: string, message: string): Promise<void> {
  if (!contractorId) return;
  const safetyLeads = await getWhere<Record<string, unknown>>("users", "contractorId = ? AND role = ?", [contractorId, "Contractor Safety Lead"]);
  
  for (const lead of safetyLeads) {
    await insert("notifications", {
      userId: lead.id,
      role: "Contractor Safety Lead",
      contractorId,
      title,
      message,
      type: "warning",
      createdAt: new Date().toISOString(),
      read: false
    });
  }
}

export async function triggerManualScan(currentUser: User): Promise<ComplianceFlag[]> {
  requireRole(currentUser, ["Safaricom Admin", "Safaricom EHS Officer"], "Only Safaricom Admins or central EHS Officers can manually trigger compliance audits.");

  const [projects, documents, documentTypes, techs, users, existingFlags] = await Promise.all([
    getAll("projects"),
    getAll("documents"),
    getAll("documentTypes"),
    getTechnicians(),
    getAll("users"),
    getAll("complianceFlags"),
  ]);

  const enrichedDocs = await enrichDocuments(
    documents as unknown as TechnicianDocument[],
    techs as unknown as Record<string, unknown>[],
    documentTypes as unknown as Record<string, unknown>[],
  );

  const { newFlags, updatedFlags } = runComplianceScan(
    projects as unknown as Project[],
    enrichedDocs,
    techs as unknown as TechnicianProfile[],
    users as unknown as User[],
    existingFlags as unknown as ComplianceFlag[]
  );

  let scanLogDetails = "Manual compliance scan completed.";

  if (newFlags.length > 0) {
    for (const f of newFlags) {
      const details = `${f.severity} severity ${f.standard} violation on ${f.targetType} "${f.targetName}": ${f.description}`;
      
      await insert("complianceFlags", f as unknown as Record<string, unknown>);
      
      if (f.severity === "High") {
        const branchId = await getFlagBranchId(f, projects, documents, techs);
        await notifyContractorSafetyLeads(branchId, "🚨 High Severity Compliance Flag Generated", details);
      }

      await insert("notifications", {
        userId: null,
        role: null,
        contractorId: null,
        title: `Compliance Alert: ${f.ruleName}`,
        message: f.description,
        type: f.severity === "High" ? "danger" : "warning",
        createdAt: new Date().toISOString(),
        read: false
      });

      await insert("auditLogs", {
        userId: 0,
        userName: "Compliance Engine",
        userRole: "Automated Service",
        action: "Regulatory Non-Compliance Flagged",
        category: "EHS Compliance",
        timestamp: new Date().toISOString(),
        details,
        contractorId: null
      });
    }
    scanLogDetails += ` Found ${newFlags.length} violations.`;
  } else {
    scanLogDetails += ` No new violations detected.`;
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

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Compliance Scan Triggered",
    category: "EHS Compliance",
    details: scanLogDetails,
    timestamp: new Date().toISOString(),
    contractorId: null
  });

  emitSSE("compliance_update", { newFlags, updatedFlags });

  return await getAll<ComplianceFlag>("complianceFlags");
}

export async function resolveComplianceFlag(
  id: number,
  comments: string,
  currentUser: User
): Promise<ComplianceFlag> {
  const flag = await getById<ComplianceFlag>("complianceFlags", id);
  if (!flag) throw new Error("Compliance flag not found");

  requireRole(currentUser, ["Safaricom Admin", "Safaricom EHS Officer", "Contractor Safety Lead", "Contractor Manager"], "Your user role is not authorized to resolve safety compliance warnings.");

  if (!comments) {
    throw new Error("Resolution comments are required.");
  }

  if (!currentUser.isCentral) {
    const [projects, documents, technicians] = await Promise.all([
      getAll("projects"),
      getAll("documents"),
      getAll("technicians"),
    ]);
    const flagBranchId = await getFlagBranchId(flag, projects, documents, technicians);
    if (flagBranchId && flagBranchId !== currentUser.contractorId) {
      throw new Error("Permission denied. You can only resolve compliance flags for your own contractor.");
    }
  }

  await update("complianceFlags", id, {
    status: "Resolved",
    resolvedAt: new Date().toISOString(),
    resolutionComments: `${currentUser.role} (${currentUser.name}): ${comments}`
  });

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Compliance Warning Resolved",
    category: "EHS Compliance",
    details: `Resolved compliance flag ID: ${flag.id} (${flag.ruleName}) - reasons: ${comments}`,
    timestamp: new Date().toISOString(),
    contractorId: null
  });

  emitSSE("compliance_update", { updatedFlags: [{ ...flag, status: "Resolved" }], newFlags: [] });

  const result = await getById<ComplianceFlag>("complianceFlags", id);
  return result!;
}
