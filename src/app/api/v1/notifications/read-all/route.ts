import { NextResponse } from "next/server";
import { readAllNotifications } from "@/src/services/notifications";
import { requireAuth } from "@/src/lib/routeAuth";

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);    const activeContractorId = user.isCentral ? (searchParams.get("contractorId") ? Number(searchParams.get("contractorId")) : null) : user.contractorId;
    await readAllNotifications(activeContractorId, user);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to mark notifications as read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return PUT(req);
}
