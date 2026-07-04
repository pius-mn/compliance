import { NextResponse } from "next/server";
import { deleteSitePhoto } from "../../../../../services/sitePhotos";
import { requireAuth } from "../../../../../lib/routeAuth";

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

    await deleteSitePhoto(id, user);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete site photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
