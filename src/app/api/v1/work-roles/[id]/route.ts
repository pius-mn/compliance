import { NextResponse } from "next/server";
import { updateWorkRole, deleteWorkRole } from "../../../../../services/workRoles";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, {
    requireCentral: true,
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);
    const updates = await req.json();

    const updated = await updateWorkRole(id, updates, user);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update work role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, {
    requireCentral: true,
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    await deleteWorkRole(id, user);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete work role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
