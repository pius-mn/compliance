import { NextResponse } from "next/server";
import { getWorkRoles, createWorkRole } from "../../../../services/workRoles";
import { requireAuth } from "../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const list = await getWorkRoles();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, {
    requireCentral: true,
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { name, documentTypeIds } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const newRole = await createWorkRole(name, documentTypeIds, user);
    return NextResponse.json(newRole);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create work role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
