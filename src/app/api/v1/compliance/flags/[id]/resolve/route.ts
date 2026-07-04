import { NextResponse } from "next/server";
import { resolveComplianceFlag } from "@/src/services/compliance";
import { requireAuth } from "@/src/lib/routeAuth";

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
    const { comments } = await req.json();

    if (!comments) {
      return NextResponse.json({ error: "Resolution comments are required." }, { status: 400 });
    }

    const flag = await resolveComplianceFlag(id, comments, user);
    return NextResponse.json(flag);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve flag";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params });
}
