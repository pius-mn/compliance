import { DocumentType, User } from "../types";
import { getAll, insert, update, remove } from "../lib";

export async function getDocumentTypes(): Promise<DocumentType[]> {
  return await getAll<DocumentType>("documentTypes");
}

export async function createDocumentType(
  name: string,
  currentUser: User
): Promise<DocumentType> {
  const id = await insert("documentTypes", { name });
  const newDocType: DocumentType = { id, name };

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Document Type Created",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Created document type "${name}"`,
    contractorId: null
  });

  return newDocType;
}

export async function updateDocumentType(
  id: number,
  updates: Partial<DocumentType>,
  currentUser: User
): Promise<DocumentType> {
  await update("documentTypes", id, updates);

  const updatedDocTypes = await getAll<DocumentType>("documentTypes");
  const updatedDocType = updatedDocTypes.find(d => d.id === id);
  if (!updatedDocType) throw new Error("Document type not found");

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Document Type Updated",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Updated document type "${updatedDocType.name}"`,
    contractorId: null
  });

  return updatedDocType;
}

export async function deleteDocumentType(
  id: number,
  currentUser: User
): Promise<void> {
  let name = "";
  const existing = await getAll<DocumentType>("documentTypes");
  const found = existing.find(d => d.id === id);
  if (found) name = found.name;

  await remove("documentTypes", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Document Type Deleted",
    category: "EHS Compliance",
    timestamp: new Date().toISOString(),
    details: `Deleted document type "${name}"`,
    contractorId: null
  });
}
