import { User, Role } from "../types";
import { getAll, getById, getWhere, insert, update, remove } from "../lib";
import { hashPassword } from "../lib/auth";
import { recalculateTechnicianScore } from "./ehs";

export async function getUsers(): Promise<User[]> {
  return await getAll<User>("users");
}

export async function createUser(
  name: string,
  email: string,
  role: Role,
  contractorId: number | null,
  isCentral: boolean,
  phone: string | undefined,
  specialization: string | undefined,
  currentUser: User
): Promise<User> {
  const username = email ? email.split('@')[0] : `user-${Date.now()}`;
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "admin";
  const hashedPassword = await hashPassword(defaultPassword);

  const userId = await insert("users", {
    name,
    email,
    role,
    contractorId,
    isCentral,
    username,
    password: hashedPassword
  });

  // If role is Field Technician, create a Technician profile
  let newTechId: number | null = null;
  if (role === Role.Technician) {
    const contractors = await getAll<Record<string, unknown>>("contractors");
    const contractor = contractors.find((c) => c.contractorId === contractorId);
    const finalContractorId = contractor ? contractor.id : contractorId;

    newTechId = await insert("technicians", {
      userId: userId,
      name,
      phone: phone || "+254 7XX XXX XXX",
      specialization: specialization || "General Technician",
      status: "EHS Check Needed",
      overallEhsScore: 0,
      contractorId: finalContractorId,
      workRoleIds: []
    });

    await recalculateTechnicianScore(newTechId, true);
  }

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "User Created",
    category: "User Management",
    timestamp: new Date().toISOString(),
    details: `Created user "${name}" with ID: ${userId} (Role: ${role})`,
    contractorId
  });

  await insert("notifications", {
    userId: null,
    role: null,
    contractorId,
    title: "User Created",
    message: `Created user "${name}" with ID: ${userId} (Role: ${role})`,
    type: "info",
    createdAt: new Date().toISOString(),
    read: false
  });

  return {
    id: userId,
    name,
    email,
    role,
    contractorId,
    isCentral,
    username
  };
}

export async function updateUser(
  id: number,
  updates: Partial<User>,
  currentUser: User
): Promise<User> {
  const existing = await getById<User>("users", id);
  if (!existing) throw new Error("User not found");

  await update("users", id, updates as Record<string, unknown>);

  const updatedUser = { ...existing, ...updates };

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "User Updated",
    category: "User Management",
    timestamp: new Date().toISOString(),
    details: `Updated user "${updatedUser.name}"`,
    contractorId: null
  });

  await insert("notifications", {
    userId: null,
    role: null,
    contractorId: null,
    title: "User Updated",
    message: `Updated user "${updatedUser.name}"`,
    type: "info",
    createdAt: new Date().toISOString(),
    read: false
  });

  return updatedUser;
}

export async function deleteUser(
  id: number,
  currentUser: User
): Promise<void> {
  const existing = await getById<User>("users", id);
  if (!existing) throw new Error("User not found");

  const deletedUser = existing;

  // Delete associated technician profile if exists
  const techs = await getWhere("technicians", "userId = ?", [id]);
  if (techs.length > 0) {
    await remove("technicians", Number(techs[0].id));
  }

  await remove("users", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "User Deleted",
    category: "User Management",
    timestamp: new Date().toISOString(),
    details: `Deleted user "${deletedUser.name}"`,
    contractorId: null
  });

  await insert("notifications", {
    userId: null,
    role: null,
    contractorId: null,
    title: "User Deleted",
    message: `Deleted user "${deletedUser.name}"`,
    type: "info",
    createdAt: new Date().toISOString(),
    read: false
  });
}
