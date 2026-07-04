import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";
import { getById } from "./database";
import { User } from "../types";

const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
    "Set a strong random secret before starting the server."
  );
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signJwt(user: User): Promise<string> {
  return new SignJWT({
    userId: String(user.id),
    role: user.role,
    contractorId: user.contractorId !== null ? String(user.contractorId) : null,
    isCentral: user.isCentral,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<{ userId: number; role: string; contractorId: string | null; isCentral: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: Number(payload.userId),
      role: payload.role as string,
      contractorId: payload.contractorId as string | null,
      isCentral: payload.isCentral as boolean,
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  try {
    const authHeader = req.headers.get("authorization");
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get("token") || "";
    }

    if (!token) return null;
    const verified = await verifyJwt(token);
    if (!verified) return null;
    const user = await getById("users", verified.userId);
    return (user as unknown as User) || null;
  } catch (error) {
    console.error("Auth helper error:", error);
    return null;
  }
}
