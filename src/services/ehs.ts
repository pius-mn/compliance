import { TechnicianDocument, User } from "../types";
import { getAll, getById, getWhere, insert, update, query } from "../lib";
import { isTechnicianInUserHub } from "../lib/permissions";
import { saveDocumentFile, moveToFinalPath, deleteDocumentFile } from "./documentStorage";

export function getTechnicianContractorId(tech: Record<string, unknown>): number | null {
  return (tech.contractorId as number | null) || null;
}

/**
 * Fetch all documents with technicianName and type resolved via SQL JOIN.
 *
 * Instead of loading ALL technicians and ALL documentTypes into memory and
 * doing O(n*m) Array.find() lookups, this pushes the enrichment to the
 * database where the new indexes (idx_documents_technician_id,
 * idx_documents_document_type_id) make the JOINs O(log n).
 */
export async function queryEnrichedDocuments(): Promise<TechnicianDocument[]> {
  const rows = await query(`
    SELECT
      d.id,
      d.technicianId,
      COALESCE(t.name, 'Unknown') AS technicianName,
      d.contractorId,
      COALESCE(dt.name, 'Unknown') AS type,
      d.documentTypeId,
      d.fileName,
      d.uploadDate,
      d.rejected,
      d.contractorApproverId,
      d.centralApproverId,
      d.expiryDate,
      d.file_path,
      d.fileMimeType
    FROM documents d
    LEFT JOIN technicians t ON t.id = d.technicianId
    LEFT JOIN documentTypes dt ON dt.id = d.documentTypeId
  `);
  return rows as unknown as TechnicianDocument[];
}

/**
 * Enrich documents with resolved technicianName and type from lookup tables.
 *
 * @deprecated Use queryEnrichedDocuments() instead — it pushes the JOIN to SQL,
 * avoiding full-table loads of technicians and documentTypes.
 */
export async function enrichDocuments(
  docs: TechnicianDocument[],
  technicians: Record<string, unknown>[],
  documentTypes: Record<string, unknown>[]
): Promise<TechnicianDocument[]> {
  return docs.map((d) => {
    const tech = technicians.find((t) => (t.id as number) === d.technicianId);
    const dt = documentTypes.find((t) => (t.id as number) === d.documentTypeId);
    return {
      ...d,
      technicianName: (tech?.name as string) || "Unknown",
      type: (dt?.name as string) || "Unknown",
    };
  });
}

export async function recalculateTechnicianScore(technicianId: number, persist: boolean = false): Promise<void> {
  const tech = await getById<Record<string, unknown>>("technicians", technicianId);
  if (!tech) return;

  const [workRoles, documents] = await Promise.all([
    getAll<Record<string, unknown>>("workRoles"),
    getAll<Record<string, unknown>>("documents"),
  ]);

  let score = 0;

  const techWorkRoleIds = tech.workRoleIds as number[] | undefined;
  if (techWorkRoleIds && techWorkRoleIds.length > 0) {
    const requiredDocTypeIds = new Set<number>();
    for (const roleId of techWorkRoleIds!) {
      const role = workRoles.find((r) => r.id === roleId);
      if (role && role.documentTypeIds) {
        (role.documentTypeIds as number[]).forEach((id: number) => requiredDocTypeIds.add(id));
      }
    }

    if (requiredDocTypeIds.size > 0) {
      let approvedCount = 0;
      for (const reqDocId of requiredDocTypeIds) {
        const hasApprovedDoc = documents.some((d) =>
          (d.technicianId as number) === (tech.id as number) &&
          (d.rejected as boolean) === false &&
          (d.contractorApproverId as number) !== null &&
          (d.centralApproverId as number) !== null &&
          (d.documentTypeId as number) === reqDocId &&
          (!d.expiryDate || new Date(d.expiryDate as string).getTime() >= Date.now())
        );
        if (hasApprovedDoc) {
          approvedCount++;
        }
      }
      score = Math.round((approvedCount / requiredDocTypeIds.size) * 100);
    } else {
      score = 100;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const newStatus = score < 70 ? "EHS Check Needed" : "Active";

  if (persist) {
    await update("technicians", technicianId, { status: newStatus });
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
  // Single JOIN query replaces 3 parallel SELECT * calls + O(n*m) in-memory find()
  return queryEnrichedDocuments();
}

async function dbTechnicianIdCheck(id: number): Promise<number> {
  const tech = await getById<Record<string, unknown>>("technicians", id);
  if (tech) return id;
  const userTechs = await getWhere<Record<string, unknown>>("technicians", "userId = ?", [id]);
  if (userTechs.length > 0) return userTechs[0].id as number;
  return id;
}

export async function uploadEHSDocument(
  payload: Partial<TechnicianDocument> & { score?: number; issues?: string[]; recommendations?: string; verifiedByAi?: boolean; fileBase64?: string; fileMimeType?: string },
  currentUser: User
): Promise<TechnicianDocument> {
  const {
    technicianId,
    fileName,
    score,
    issues,
    verifiedByAi,
    documentTypeId,
    expiryDate,
    fileBase64,
    fileMimeType,
  } = payload;

  if (!technicianId || !fileName) {
    throw new Error("Missing technicianId or fileName");
  }

  // Normalize documentTypeId to a number — the frontend may send it as a string
  const docTypeRaw = documentTypeId as (number | string | null | undefined);
  const rawNumeric = docTypeRaw != null && docTypeRaw !== "" ? Number(docTypeRaw) : null;
  const numericDocTypeId = rawNumeric != null && !isNaN(rawNumeric) ? rawNumeric : null;

  // Resolve document type name for display/audit purposes
  const documentTypes = await getAll<Record<string, unknown>>("documentTypes");
  const docTypeName = documentTypes.find((dt: Record<string, unknown>) => (dt.id as number) === numericDocTypeId)?.name as string || "Document";

  // Find technician
  const targetTechId = await dbTechnicianIdCheck(technicianId);
  const tech = await getById<Record<string, unknown>>("technicians", targetTechId);
  if (!tech) {
    throw new Error("Technician profile not found");
  }

  // Safety check on technician ownership - Contractor isolation
  if (!isTechnicianInUserHub(tech, currentUser)) {
    throw new Error("Permission denied for this technician.");
  }

  // Security check - AI verification
  if (verifiedByAi === false) {
    const issuesList = issues && issues.length > 0 ? issues : [];
    const reasonText = issuesList.length > 0 
      ? `Reason: AI Audit detected safety non-compliances: ${issuesList.join("; ")}`
      : `Reason: EHS compliance score is only ${score || 0}%, which is below the required 70% threshold.`;
    throw new Error(`Cannot submit a document that failed AI compliance verification. ${reasonText}`);
  }

  const contractorId = getTechnicianContractorId(tech) || currentUser.contractorId || 0;

  // Check for existing active/pending document of the same type (using numeric comparison)
  const existingDocs = await getWhere("documents",
    "technicianId = ? AND documentTypeId = ? AND rejected = FALSE",
    [(tech.id as number), numericDocTypeId || 0]
  );
  
  const existingCert = existingDocs.find((d) => {
    const doc = d as Record<string, unknown>;
    // Use numeric comparison to avoid string-vs-number type mismatch
    if (Number(doc.documentTypeId) !== numericDocTypeId) return false;
    // Skip expired documents
    if (doc.expiryDate && new Date(doc.expiryDate as string).getTime() < Date.now()) return false;
    return true;
  });

  let docId: number;
  let isUpdate = false;
  let tempFilePath: string | null = null;

  // Save file to temp location first (before we know the docId for new docs)
  if (fileBase64) {
    tempFilePath = saveDocumentFile(fileBase64, fileName || "document");
  }

  if (existingCert) {
    // Overwrite existing document: update fields and reset approval workflow
    const existing = existingCert as Record<string, unknown>;
    docId = existing.id as number;
    isUpdate = true;

    // Delete old file from disk if present
    const existingFilePath = existing.file_path as string | null;
    if (existingFilePath) {
      deleteDocumentFile(existingFilePath);
    }

    // Save file to final path if we have base64 data
    let filePath: string | null = null;
    if (tempFilePath && fileName) {
      filePath = moveToFinalPath(tempFilePath, docId, fileName);
    }

    await update("documents", docId, {
      fileName: fileName || "",
      uploadDate: new Date().toISOString().split("T")[0],
      rejected: false,
      contractorApproverId: null,
      centralApproverId: null,
      expiryDate: expiryDate || null,
      file_path: filePath,
      fileMimeType: fileMimeType || null,
    });
  } else {
    // No existing document — create new
    docId = await insert("documents", {
      technicianId: tech.id as number,
      contractorId: contractorId || 0,
      documentTypeId: numericDocTypeId,
      fileName: fileName || "",
      uploadDate: new Date().toISOString().split("T")[0],
      rejected: false,
      contractorApproverId: null,
      centralApproverId: null,
      expiryDate: expiryDate || null,
      file_path: null,
      fileMimeType: fileMimeType || null,
    });

    // Move temp file to final path now that we have the docId
    if (tempFilePath && fileName) {
      const filePath = moveToFinalPath(tempFilePath, docId, fileName);
      await update("documents", docId, { file_path: filePath });
    }
  }

  // Re-read file_path from DB so the returned object is always accurate
  const savedDoc = await getById<Record<string, unknown>>("documents", docId);
  const finalFilePath = savedDoc?.file_path as string | null;

  const newDoc: TechnicianDocument = {
    id: docId,
    technicianId: tech.id as number,
    technicianName: tech.name as string,
    type: docTypeName,
    contractorId: contractorId || 0,
    documentTypeId: numericDocTypeId,
    fileName: fileName || "",
    uploadDate: new Date().toISOString().split("T")[0],
    rejected: false,
    contractorApproverId: null,
    centralApproverId: null,
    expiryDate: expiryDate || null,
    file_path: finalFilePath,
    fileMimeType: fileMimeType || null,
    fileData: null,
  };

  // If there's an AI compliance update, recalculate EHS overall scores
  if (score !== undefined && score !== null) {
    await update("technicians", tech.id as number, {
      lastEhsAuditDate: newDoc.uploadDate
    });
    await recalculateTechnicianScore(tech.id as number, true);
  }

  const auditAction = isUpdate ? "EHS Document Updated" : "EHS Document Uploaded";
  const auditDetails = isUpdate
    ? `Technician "${tech.name as string}" updated EHS document: "${docTypeName}" (${fileName}) — previous approval reset, pending re-approval`
    : `Technician "${tech.name as string}" uploaded EHS document: "${docTypeName}" (${fileName})`;

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: auditAction,
    category: "EHS Compliance",
    details: auditDetails,
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

  let auditAction = "";
  let auditDetails = "";

  let newContractorApproverId: number | null = d.contractorApproverId as number | null;
  let newCentralApproverId: number | null = d.centralApproverId as number | null;

  const uRole = u.role as string;
  const uId = u.id as number;
  const uName = u.name as string;
  const dId = d.id as number;
  const dTechId = d.technicianId as number;
  const dContractorId = d.contractorId as number | null;

  if (uRole === "Contractor Safety Lead" || uRole === "Contractor Manager") {
    newContractorApproverId = uId;
    auditAction = "EHS Contractor Approval given";
    auditDetails = `Contractor approved document ID: ${dId} - comments input: ${comment || 'N/A'}`;
  } else if (uRole === "Safaricom EHS Officer" || uRole === "Safaricom Admin") {
    newCentralApproverId = uId;
    auditAction = "EHS Central Approval given";
    auditDetails = `Central finalized approval for document ID: ${dId}`;

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
    contractorApproverId: newContractorApproverId,
    centralApproverId: newCentralApproverId
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

  // Resolve document type name from documentTypes table
  const documentTypes = await getAll<Record<string, unknown>>("documentTypes");
  const docTypeName = documentTypes.find((dt: Record<string, unknown>) => (dt.id as number) === (d.documentTypeId as number))?.name as string || "Document";

  // Security check - contractor isolation
  if (!(u.isCentral as boolean) && (d.contractorId as number | null) !== (u.contractorId as number | null)) {
    throw new Error("Permission denied for this document.");
  }

  await update("documents", docId, {
    rejected: true
  });

  // Recalculate technician safety score (gets lowered as approved is gone)
  const tech = await getById<Record<string, unknown>>("technicians", d.technicianId as number);
  if (tech) {
    await recalculateTechnicianScore(tech.id as number, true);
  }

  await notifyContractorSafetyLeads(
    d.contractorId as number | null,
    "🚨 Document Rejected: " + (d.fileName as string),
    `The document "${d.fileName as string}" (Type: ${docTypeName}) has been rejected. Comment: ${comment}`
  );

  await insert("auditLogs", {
    userId: u.id as number,
    userName: u.name as string,
    userRole: u.role as string,
    action: "EHS Document Rejected",
    category: "EHS Compliance",
    details: `Rejected EHS Doc ID ${d.id as number} (${docTypeName}) - Audit reason: ${comment}`,
    timestamp: new Date().toISOString(),
    contractorId: d.contractorId as number | null
  });

  const result = await getById<TechnicianDocument>("documents", docId);
  return result!;
}
