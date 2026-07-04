import { TechnicianDocument, User } from "../types";
import { getAll, getById, getWhere, insert, update } from "../lib";
import { isTechnicianInUserHub } from "../lib/permissions";

export function getTechnicianContractorId(tech: Record<string, unknown>): number | null {
  return (tech.contractorId as number | null) || null;
}

export async function recalculateTechnicianScore(technicianId: number, persist: boolean = false): Promise<void> {
  const tech = await getById<Record<string, unknown>>("technicians", technicianId);
  if (!tech) return;

  const [workRoles, documentTypes, documents] = await Promise.all([
    getAll<Record<string, unknown>>("workRoles"),
    getAll<Record<string, unknown>>("documentTypes"),
    getAll<Record<string, unknown>>("documents"),
  ]);

  let score = 0;

  const techWorkRoleIds = tech.workRoleIds as number[] | undefined;
  if (techWorkRoleIds && techWorkRoleIds.length > 0) {
    // Collect all unique document type IDs required by the technician's work roles
    const requiredDocTypeIds = new Set<number>();
    for (const roleId of techWorkRoleIds!) {
      const role = workRoles.find((r) => r.id === roleId);
      if (role && role.documentTypeIds) {
        (role.documentTypeIds as number[]).forEach((id: number) => requiredDocTypeIds.add(id));
      }
    }

    if (requiredDocTypeIds.size > 0) {
      // Count how many required document types have been approved for this technician
      let approvedCount = 0;
      for (const reqDocId of requiredDocTypeIds) {
        const dtName = documentTypes.find((dt) => (dt.id as number) === reqDocId)?.name;
        const hasApprovedDoc = documents.some((d) =>
          (d.technicianId as number) === (tech.id as number) &&
          d.status === "Approved" &&
          ((d.documentTypeId as number) === reqDocId || (dtName && d.type === dtName))
        );
        if (hasApprovedDoc) {
          approvedCount++;
        }
      }

      // Score = approved documents / total required documents × 100
      score = Math.round((approvedCount / requiredDocTypeIds.size) * 100);
    } else {
      // Has work roles but no document types required — no requirements to meet
      score = 100;
    }
  }
  // If no work roles assigned, score stays 0

  score = Math.max(0, Math.min(100, score));

  const newStatus = score < 70 ? "EHS Check Needed" : "Active";

  if (persist) {
    await update("technicians", technicianId, {
      overallEhsScore: score,
      status: newStatus
    });
  }
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

export async function getEHSDocuments(): Promise<TechnicianDocument[]> {
  return await getAll<TechnicianDocument>("documents");
}

async function dbTechnicianIdCheck(id: number): Promise<number> {
  const tech = await getById<Record<string, unknown>>("technicians", id);
  if (tech) return id;
  const userTechs = await getWhere<Record<string, unknown>>("technicians", "userId = ?", [id]);
  if (userTechs.length > 0) return userTechs[0].id as number;
  return id;
}

export async function uploadEHSDocument(
  payload: Partial<TechnicianDocument> & { score?: number; issues?: string[]; recommendations?: string; verifiedByAi?: boolean },
  currentUser: User
): Promise<TechnicianDocument> {
  const {
    technicianId,
    type,
    fileName,
    projectId,
    score,
    issues,
    recommendations,
    verifiedByAi,
    summary,
    extractedData,
    flaggedIssues,
    previousVersionId,
    documentTypeId,
    expiryDate
  } = payload;

  if (!technicianId || !type || !fileName) {
    throw new Error("Missing technicianId, type or fileName");
  }

  // Find technician
  const targetTechId = await dbTechnicianIdCheck(technicianId);
  const tech = await getById<Record<string, unknown>>("technicians", targetTechId);
  if (!tech) {
    throw new Error("Technician profile not found");
  }

  // Prevention check: active/pending duplicate certificates
  const existingDocs = await getWhere("documents",
    "technicianId = ? AND (documentTypeId = ? OR type = ?) AND (status = ? OR status = ? OR status = ?)",
    [(tech.id as number), documentTypeId || 0, type || "", "Approved", "Pending Contractor Approval", "Pending Central Approval"]
  );
  
  const existingCert = existingDocs.find((d) => 
    (documentTypeId ? (d as Record<string, unknown>).documentTypeId === documentTypeId : (d as Record<string, unknown>).type === type)
  );
  if (existingCert) {
    throw new Error(`A valid document for ${type} is already active or awaiting approval.`);
  }

  // Safety check on technician ownership - Contractor isolation
  if (!isTechnicianInUserHub(tech, currentUser)) {
    throw new Error("Permission denied for this technician.");
  }

  // Security check - AI verification
  if (verifiedByAi === false) {
    const issuesList = (flaggedIssues && flaggedIssues.length > 0) ? flaggedIssues : (issues && issues.length > 0 ? issues : []);
    const reasonText = issuesList.length > 0 
      ? `Reason: AI Audit detected safety non-compliances: ${issuesList.join("; ")}`
      : `Reason: EHS compliance score is only ${score || 0}%, which is below the required 70% threshold.`;
    throw new Error(`Cannot submit a document that failed AI compliance verification. ${reasonText}`);
  }

  const contractorId = getTechnicianContractorId(tech) || currentUser.contractorId || 0;

  const newDocId = await insert("documents", {
    technicianId: tech.id as number,
    technicianName: tech.name as string,
    contractorId: contractorId || 0,
    projectId: projectId || null,
    type: type || "",
    documentTypeId: documentTypeId || null,
    fileName: fileName || "",
    uploadDate: new Date().toISOString().split("T")[0],
    status: "Pending Contractor Approval",
    contractorApproverId: null,
    centralApproverId: null,
    approvalChainComments: [],
    complianceResult: score !== undefined && score !== null ? {
      score: Number(score) || 80,
      issues: issues || [],
      recommendations: recommendations || "Regular EHS checking recommended.",
      verifiedByAi: !!verifiedByAi
    } : null,
    summary: summary || null,
    extractedData: extractedData || null,
    flaggedIssues: flaggedIssues || null,
    previousVersionId: previousVersionId || null,
    expiryDate: expiryDate || null
  });

  const newDoc: TechnicianDocument = {
    id: newDocId,
    technicianId: tech.id as number,
    technicianName: tech.name as string,
    contractorId: contractorId || 0,
    projectId: projectId || null,
    type: type || "",
    documentTypeId: documentTypeId || null,
    fileName: fileName || "",
    uploadDate: new Date().toISOString().split("T")[0],
    status: "Pending Contractor Approval",
    contractorApproverId: null,
    centralApproverId: null,
    approvalChainComments: [],
    complianceResult: score !== undefined && score !== null ? {
      score: Number(score) || 80,
      issues: issues || [],
      recommendations: recommendations || "Regular EHS checking recommended.",
      verifiedByAi: !!verifiedByAi
    } : null,
    summary: summary || null,
    extractedData: extractedData || null,
    flaggedIssues: flaggedIssues || null,
    previousVersionId: previousVersionId || null,
    expiryDate: expiryDate || null
  };

  // If there's an AI compliance update, recalculate EHS overall scores
  if (score !== undefined && score !== null) {
    await update("technicians", tech.id as number, {
      lastEhsAuditDate: newDoc.uploadDate
    });
    await recalculateTechnicianScore(tech.id as number, true);
  }

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "EHS Document Uploaded",
    category: "EHS Compliance",
    details: `Technician "${tech.name as string}" uploaded EHS document: "${type}" (${fileName})`,
    timestamp: new Date().toISOString(),
    contractorId: contractorId || 0
  });

  return newDoc;
}

export async function approveEHSDocument(
  docId: number,
  approverId: number,
  comment: string
): Promise<TechnicianDocument> {
  const docObj = await getById<Record<string, unknown>>("documents", docId);
  if (!docObj) throw new Error("EHS Document not found");

  const user = await getById<Record<string, unknown>>("users", approverId);
  if (!user) throw new Error("Approver user not found");

  const d = docObj as Record<string, unknown>;
  const u = user as Record<string, unknown>;

  // Security check - contractor isolation
  if (!(u.isCentral as boolean) && (d.contractorId as number | null) !== (u.contractorId as number | null)) {
    throw new Error("Permission denied for this document.");
  }

  // Security check - AI verification
  const complianceResult = d.complianceResult as Record<string, unknown> | null;
  if (complianceResult && (complianceResult.verifiedByAi as boolean) === false) {
    throw new Error("Cannot approve a document that failed AI compliance verification.");
  }

  const approvalChainComments = (d.approvalChainComments as string[]) || [];
  const formattedComment = `${u.role as string}: ${comment || "Approved without comments."}`;
  const updatedComments = [...approvalChainComments, formattedComment];
  
  let auditAction = "";
  let auditDetails = "";

  let newStatus: string;
  let newContractorApproverId: number | null = d.contractorApproverId as number | null;
  let newCentralApproverId: number | null = d.centralApproverId as number | null;

  const uRole = u.role as string;
  const uId = u.id as number;
  const uName = u.name as string;
  const dId = d.id as number;
  const dType = d.type as string;
  const dTechId = d.technicianId as number;
  const dContractorId = d.contractorId as number | null;

  if (uRole === "Contractor Safety Lead" || uRole === "Contractor Manager") {
    newStatus = "Pending Central Approval";
    newContractorApproverId = uId;
    auditAction = "EHS Contractor Approval given";
    auditDetails = `Contractor approved document ID: ${dId} (${dType}) - comments input: ${comment || 'N/A'}`;
  } else if (uRole === "Safaricom EHS Officer" || uRole === "Safaricom Admin") {
    newStatus = "Approved";
    newCentralApproverId = uId;
    auditAction = "EHS Central Approval given";
    auditDetails = `Central finalized approval for document ID: ${dId} (${dType})`;

    // Recalculate technician safety score
    const tech = await getById<Record<string, unknown>>("technicians", dTechId);
    if (tech) {
      const techId = tech.id as number;
      await update("technicians", techId, {
        lastEhsAuditDate: new Date().toISOString().split("T")[0]
      });
      await recalculateTechnicianScore(techId, true);
    }
  } else {
    throw new Error("Your user role is not authorized to grant safety approvals.");
  }

  await update("documents", docId, {
    status: newStatus,
    contractorApproverId: newContractorApproverId,
    centralApproverId: newCentralApproverId,
    approvalChainComments: updatedComments
  });

  await insert("auditLogs", {
    userId: uId,
    userName: uName,
    userRole: uRole,
    action: auditAction,
    category: "EHS Compliance",
    details: auditDetails,
    timestamp: new Date().toISOString(),
    contractorId: dContractorId
  });

  const result = await getById<TechnicianDocument>("documents", docId);
  return result!;
}

export async function rejectEHSDocument(
  docId: number,
  approverId: number,
  comment: string
): Promise<TechnicianDocument> {
  const docObj = await getById<Record<string, unknown>>("documents", docId);
  if (!docObj) throw new Error("EHS Document not found");

  const user = await getById<Record<string, unknown>>("users", approverId);
  if (!user) throw new Error("Approver user not found");

  if (!comment) {
    throw new Error("Audit reason/comments are required for rejection.");
  }

  const d = docObj as Record<string, unknown>;
  const u = user as Record<string, unknown>;

  // Security check - contractor isolation
  if (!(u.isCentral as boolean) && (d.contractorId as number | null) !== (u.contractorId as number | null)) {
    throw new Error("Permission denied for this document.");
  }

  const approvalChainComments = (d.approvalChainComments as string[]) || [];
  const updatedComments = [...approvalChainComments, `${u.role as string} REJECTION: ${comment}`];

  await update("documents", docId, {
    status: "Rejected",
    approvalChainComments: updatedComments
  });

  // Recalculate technician safety score (gets lowered as approved is gone)
  const tech = await getById<Record<string, unknown>>("technicians", d.technicianId as number);
  if (tech) {
    await recalculateTechnicianScore(tech.id as number, true);
  }

  await notifyContractorSafetyLeads(
    d.contractorId as number | null,
    "🚨 Document Rejected: " + (d.fileName as string),
    `The document "${d.fileName as string}" (Type: ${d.type as string}) has been rejected. Comment: ${comment}`
  );

  await insert("auditLogs", {
    userId: u.id as number,
    userName: u.name as string,
    userRole: u.role as string,
    action: "EHS Document Rejected",
    category: "EHS Compliance",
    details: `Rejected EHS Doc ID ${d.id as number} (${d.type as string}) - Audit reason: ${comment}`,
    timestamp: new Date().toISOString(),
    contractorId: d.contractorId as number | null
  });

  const result = await getById<TechnicianDocument>("documents", docId);
  return result!;
}
