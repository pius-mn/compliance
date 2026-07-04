import { NextResponse } from "next/server";
import { getDocumentTypes, createDocumentType } from "../../../../services/documentTypes";
import { requireAuth } from "../../../../lib/routeAuth";


export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const list = await getDocumentTypes();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, {
    requireCentral: true,
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Document name is required" }, { status: 400 });
    }

    const newDocType = await createDocumentType(name, user);
    return NextResponse.json(newDocType);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create document type";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
