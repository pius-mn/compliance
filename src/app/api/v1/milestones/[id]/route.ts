import { NextResponse } from "next/server";
import { updateMilestone } from "../../../../../services/milestones";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);
    const updates = await req.json();

    const updated = await updateMilestone(id, updates, user);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update milestone";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
