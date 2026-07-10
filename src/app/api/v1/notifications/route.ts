import { NextResponse } from "next/server";
import { getFilteredNotifications } from "@/src/services/notifications";
import { requireAuth } from "@/src/lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);

    // Resolve filter scope — central users can filter by any contractor/user,
    // non-central users are scoped to their own contractor.
    const activeContractorId = user.isCentral
      ? url.searchParams.get("contractorId")
        ? Number(url.searchParams.get("contractorId"))
        : null
      : user.contractorId;
    const role = url.searchParams.get("role") || user.role;
    const userId = url.searchParams.get("userId")
      ? Number(url.searchParams.get("userId"))
      : user.id;
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    // Push filtering all the way to SQL — no more loading every row into
    // Node.js memory just to discard 95% of them.
    const { data, total } = await getFilteredNotifications({
      contractorId: activeContractorId,
      role,
      userId,
      page: page && page > 0 ? page : undefined,
      limit: limit && limit > 0 ? limit : undefined,
    });

    if (page != null && limit != null && page > 0 && limit > 0) {
      return new NextResponse(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Total-Count": total.toString(),
          "X-Page": page.toString(),
          "X-Limit": limit.toString(),
        },
      });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
