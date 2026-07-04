import { NextResponse } from "next/server";
import { triggerManualScan } from "@/src/services/compliance";
import { requireAuth } from "@/src/lib/routeAuth";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const list = await triggerManualScan(user);
    return NextResponse.json({ success: true, flags: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to trigger scan";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
