import { NextResponse } from "next/server";
import { getContractors, onboardContractor } from "../../../../services/contractors";
import { requireAuth } from "../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let list = await getContractors();
  if (!user.isCentral) {
    list = list.filter(c => c.id === user.contractorId);
  }

  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, {
    allowedRoles: ["Safaricom Admin", "Safaricom EHS Officer", "Safaricom Project Assigner"],
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { name, contactPerson, email, phone } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Contractor name is required" }, { status: 400 });
    }

    const newContractor = await onboardContractor(name, contactPerson, email, phone, user);
    return NextResponse.json(newContractor);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to onboard contractor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
