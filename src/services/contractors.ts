import { Contractor, User } from "../types";
import { getAll, getById, getWhere, insert, update, remove } from "../lib";
import { hashPassword } from "../lib/auth";

export async function getContractors(): Promise<Contractor[]> {
  return await getAll<Contractor>("contractors");
}

export async function onboardContractor(
  name: string,
  contactPerson: string,
  email: string,
  phone: string,
  currentUser: User
): Promise<Contractor> {
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "admin";
  const hashedPw = await hashPassword(defaultPassword);

  // Step 1: Insert contractor first (without managerId) to get auto-generated ID
  const contractorId = await insert("contractors", {
    name,
    code: (name.split(" ").map(w => w[0]).join("").substring(0, 3).toUpperCase() || "CON") + "-" + Math.floor(Math.random() * 1000),
    location: "Contractor Registered Office",
    ehsOfficerId: null,
    managerId: null,
    contactPerson: contactPerson || "",
    email: email || "",
    phone: phone || "",
    status: "Active"
  });

  // Step 2: Insert user (manager) with the contractor's ID, get auto-generated userId
  const managerId = await insert("users", {
    name: contactPerson ? `${contactPerson} (Manager)` : `${name} Manager`,
    email: email || `manager@${name.toLowerCase().replace(/\s+/g, "")}.co.ke`,
    role: "Contractor Manager",
    contractorId: contractorId,
    isCentral: false,
    password: hashedPw
  });

  // Step 3: Update contractor with the manager's ID
  await update("contractors", contractorId, { managerId } );

  const newContractor: Contractor = {
    id: contractorId,
    name,
    code: (name.split(" ").map(w => w[0]).join("").substring(0, 3).toUpperCase() || "CON") + "-" + Math.floor(Math.random() * 1000),
    location: "Contractor Registered Office",
    ehsOfficerId: null,
    managerId,
    contactPerson: contactPerson || "",
    email: email || "",
    phone: phone || "",
    status: "Active"
  };

  // Notification (no explicit id needed - AUTO_INCREMENT)
  await insert("notifications", {
    userId: managerId,
    role: null,
    contractorId: contractorId,
    title: "Welcome to Safaricom EHS",
    message: `Your corporate contractor workspace for ${name} has been provisioned.`,
    type: "success",
    createdAt: new Date().toISOString(),
    read: false
  });

  // Audit log (no explicit id needed - AUTO_INCREMENT)
  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Contractor Onboarded",
    category: "System",
    timestamp: new Date().toISOString(),
    details: `Onboarded "${name}" as a single entity with dedicated Workspace: ${contractorId}`,
    contractorId: contractorId
  });

  return newContractor;
}

export async function updateContractor(id: number, updates: Partial<Contractor>, currentUser: User): Promise<Contractor> {
  const existing = await getById<Contractor>("contractors", id);
  if (!existing) throw new Error("Contractor not found");

  await update("contractors", id, updates as Record<string, unknown>);

  const updatedContractor = { ...existing, ...updates } as Contractor;

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Contractor Updated",
    category: "System",
    timestamp: new Date().toISOString(),
    details: `Updated contractor "${updatedContractor.name}"`,
    contractorId: updatedContractor.id || null
  });

  return updatedContractor;
}

export async function deleteContractor(id: number, currentUser: User): Promise<void> {
  const existing = await getById<Contractor>("contractors", id);
  if (!existing) throw new Error("Contractor not found");

  // Check for active projects
  const contractorProjects = await getWhere("projects", "contractorId = ?", [id]);
  if (contractorProjects.length > 0) throw new Error("Cannot delete contractor with active projects");

  const name = existing.name;

  await remove("contractors", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Contractor Deleted",
    category: "System",
    timestamp: new Date().toISOString(),
    details: `Deleted contractor "${name}"`,
    contractorId: id
  });
}
