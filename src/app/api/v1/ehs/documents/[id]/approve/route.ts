import { NextResponse } from "next/server";
import { approveEHSDocument } from "@/src/services/ehs";
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

    if (!userId) {
      return NextResponse.json({ error: "userId is required for approval workflow." }, { status: 400 });
    }

    const updatedDoc = await approveEHSDocument(docId, Number(userId), comment);
    return NextResponse.json(updatedDoc);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to approve document";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}
