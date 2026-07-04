import { NextResponse } from "next/server";
import { getUsers, createUser } from "../../../../services/users";
import { requireAuth } from "../../../../lib/routeAuth";
import { isTechnician, isSafaricomRole } from "../../../../lib/permissions";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const roleFilter = url.searchParams.get("role") || "";
  const pageStr = url.searchParams.get("page");
  const limitStr = url.searchParams.get("limit");

  let list = await getUsers();
  if (!user.isCentral) {
    list = list.filter(u => u.contractorId === user.contractorId || u.isCentral === true);
  }

  // Server-side search
  if (search) {
    list = list.filter(u =>
      (u.name || "").toLowerCase().includes(search) ||
      (u.email || "").toLowerCase().includes(search)
    );
  }

  // Server-side role filter (supports comma-separated multiple roles)
  if (roleFilter) {
    const roles = roleFilter.split(",").map(r => r.trim()).filter(Boolean);
    list = list.filter(u => roles.includes(u.role));
  }

  const page = pageStr ? parseInt(pageStr, 10) : NaN;
  const limit = limitStr ? parseInt(limitStr, 10) : NaN;

  if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
    const startIndex = (page - 1) * limit;
    const paginatedSlice = list.slice(startIndex, startIndex + limit);

    return new NextResponse(JSON.stringify(paginatedSlice), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Total-Count": list.length.toString(),
        "X-Page": page.toString(),
        "X-Limit": limit.toString(),
      },
    });
  }

  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, {
    allowedRoles: ["Safaricom Admin", "Safaricom EHS Officer", "Contractor Manager", "Contractor Safety Lead"],
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { name, email, role, contractorId, isCentral, phone, specialization } = await req.json();
  if (!name || !email || !role) {
    return NextResponse.json({ error: "Name, email, and role are required" }, { status: 400 });
  }

  // Contractor constraints: they can only register Field Technicians for their own contractor
  if (user.role === "Contractor Manager" || user.role === "Contractor Safety Lead") {
    if (!isTechnician(role)) {
      return NextResponse.json(
        { error: "Contractors can only onboard Field Technicians." },
        { status: 403 }
      );
    }
  }

  // Enforce contractor isolation for non-central users
  const finalContractorId = user.isCentral ? (contractorId || null) : user.contractorId;
  const finalIsCentral = user.isCentral ? (isSafaricomRole(role) ? true : !!isCentral) : false;

  try {
    const newUser = await createUser(
      name,
      email,
      role,
      finalContractorId,
      finalIsCentral,
      phone,
      specialization,
      user
    );
    return NextResponse.json(newUser);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
