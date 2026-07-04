import { NextResponse } from "next/server";
import { getWhere, query } from "../../../../../lib";
import { signJwt, verifyPassword, hashPassword } from "@/src/lib/auth";
import type { User } from "../../../../../types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const users = await getWhere("users", "LOWER(email) = ?", [email]);
    const row = users[0] as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (row.password) {
      const valid = await verifyPassword(password, row.password as string);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
    } else {
      // First-time login: hash and persist the password
      const hashedPw = await hashPassword(password);
      await query("UPDATE users SET password = ? WHERE id = ?", [
        hashedPw,
        row.id as number,
      ]);
    }

    const user = row as unknown as { id: number; name: string; email: string; role: string; contractorId?: number; isCentral?: boolean; username?: string; password?: string };

    const token = await signJwt(user as unknown as User);
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contractorId: user.contractorId ?? null,
        isCentral: user.isCentral ?? false,
        username: user.username,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
