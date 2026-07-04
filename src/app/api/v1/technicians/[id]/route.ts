import { NextResponse } from "next/server";
import { updateTechnicianRoles, updateTechnicianDetails, deleteTechnician } from "../../../../../services/technicians";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);
    const { workRoleIds, userId } = await req.json();

    const updatedTech = await updateTechnicianRoles(id, workRoleIds, userId ? Number(userId) : undefined, user);
    return NextResponse.json(updatedTech);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to patch technician";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const { name, phone, specialization, email } = await req.json();

    const updatedTech = await updateTechnicianDetails(id, { name, phone, specialization, email }, user);
    return NextResponse.json(updatedTech);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update technician";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const id = Number(resolvedParams.id);

    await deleteTechnician(id, user);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete technician";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
