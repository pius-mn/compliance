import { NextResponse } from "next/server";
import { getNotifications } from "@/src/services/notifications";
import { requireAuth } from "@/src/lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);
    const activeContractorId = user.isCentral ? url.searchParams.get("contractorId") : user.contractorId;
    const role = url.searchParams.get("role") || user.role;
    const userId = url.searchParams.get("userId") || user.id;
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");

    const list = await getNotifications();
    const result = list.filter(n => {
      const isBroadcast = n.contractorId === null && n.role === null && n.userId === null;
      const branchMatch = activeContractorId && n.contractorId === activeContractorId;
      const roleMatch = role && n.role === role;
      const userMatch = userId && n.userId === userId;
      return isBroadcast || branchMatch || roleMatch || userMatch;
    });

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const page = pageStr ? parseInt(pageStr, 10) : NaN;
    const limit = limitStr ? parseInt(limitStr, 10) : NaN;

    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const startIndex = (page - 1) * limit;
      const paginatedSlice = result.slice(startIndex, startIndex + limit);

      return new NextResponse(JSON.stringify(paginatedSlice), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Total-Count": result.length.toString(),
          "X-Page": page.toString(),
          "X-Limit": limit.toString(),
        },
      });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
