import { NextResponse } from "next/server";
import { getAuditLogs } from "@/src/services/auditLogs";
import { requireAuth } from "@/src/lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);
    const activeContractorId = user.isCentral ? url.searchParams.get("contractorId") : user.contractorId;
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");

    const list = await getAuditLogs();

    // Sort descending by timestamp
    let result = [...list].sort((a, b) => {
      return new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime();
    });

    if (activeContractorId) {
      const contractorId = Number(activeContractorId);
      if (user.isCentral) {
        result = result.filter(log => log.contractorId === contractorId || log.contractorId === null);
      } else {
        result = result.filter(log => log.contractorId === contractorId);
      }
    } else if (!user.isCentral) {
      result = [];
    }

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
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
