import { NextResponse } from "next/server";
import { getTechnicians } from "../../../../services/technicians";
import { isTechnicianInUserHub } from "../../../../lib/permissions";
import { requireAuth } from "../../../../lib/routeAuth";
import { getAll } from "../../../../lib";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let list = await getTechnicians();
  if (!user.isCentral) {
    list = [];
    const allTechs = await getAll<Record<string, unknown>>("technicians");
    for (const t of allTechs) {
      if (await isTechnicianInUserHub(t, user)) {
        list.push(t);
      }
    }
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const statusFilter = url.searchParams.get("status") || "";
  const sortBy = url.searchParams.get("sortBy") || "";
  const sortDir = url.searchParams.get("sortDir") === "desc" ? -1 : 1;
  const pageStr = url.searchParams.get("page");
  const limitStr = url.searchParams.get("limit");

  // Server-side search
  if (search) {
    list = list.filter((t: Record<string, unknown>) =>
      ((t.name as string) || "").toLowerCase().includes(search) ||
      ((t.specialization as string) || "").toLowerCase().includes(search) ||
      ((t.phone as string) || "").toLowerCase().includes(search)
    );
  }

  // Server-side status filter
  if (statusFilter && statusFilter !== "All") {
    list = list.filter((t: Record<string, unknown>) => t.status === statusFilter);
  }

  // Server-side sorting
  if (sortBy) {
    list = [...list].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      let valA: string | number, valB: string | number;
      switch (sortBy) {
        case "name":
          valA = ((a.name as string) || "").toLowerCase();
          valB = ((b.name as string) || "").toLowerCase();
          break;
        case "score":
          valA = (a.overallEhsScore as number) || 0;
          valB = (b.overallEhsScore as number) || 0;
          break;
        case "status":
          valA = (a.status as string) || "";
          valB = (b.status as string) || "";
          break;
        case "date":
          valA = (a.lastEhsAuditDate as string) || "";
          valB = (b.lastEhsAuditDate as string) || "";
          break;
        default:
          valA = ((a.name as string) || "").toLowerCase();
          valB = ((b.name as string) || "").toLowerCase();
      }
      if (valA < valB) return -1 * sortDir;
      if (valA > valB) return 1 * sortDir;
      return 0;
    });
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
