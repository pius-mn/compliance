import { NextResponse } from "next/server";
import { requireAuth } from "@/src/lib/routeAuth";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;
    return NextResponse.json({ user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Session verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
