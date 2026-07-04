import { NextResponse } from "next/server";
import { rejectEHSDocument } from "@/src/services/ehs";
import { requireAuth } from "@/src/lib/routeAuth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const resolvedParams = await params;
    const docId = Number(resolvedParams.id);
    const { userId, comment } = await req.json();

    if (!userId || !comment) {
      return NextResponse.json({ error: "userId and audit reason/comments are required for rejection." }, { status: 400 });
    }

    const updatedDoc = await rejectEHSDocument(docId, Number(userId), comment);
    return NextResponse.json(updatedDoc);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reject document";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}
