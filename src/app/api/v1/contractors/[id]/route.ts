import { NextResponse } from "next/server";
import { updateContractor, deleteContractor } from "../../../../../services/contractors";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, {
    allowedRoles: ["Safaricom Admin", "Safaricom EHS Officer"],
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);
    const updates = await req.json();

    const updated = await updateContractor(id, updates, user);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update contractor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, {
    allowedRoles: ["Safaricom Admin", "Safaricom EHS Officer"],
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    await deleteContractor(id, user);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete contractor";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
