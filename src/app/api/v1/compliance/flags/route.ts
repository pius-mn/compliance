import { NextResponse } from "next/server";
import { getComplianceFlags } from "@/src/services/compliance";
import { requireAuth } from "@/src/lib/routeAuth";
import { getAll } from "@/src/lib";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);
    const activeContractorId = user.isCentral ? url.searchParams.get("contractorId") : user.contractorId;
    const standardFilter = url.searchParams.get("standard") || "";
    const severityFilter = url.searchParams.get("severity") || "";
    const statusFilter = url.searchParams.get("status") || "";
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");

    let list = await getComplianceFlags();

    if (activeContractorId) {
      const [projects, documents, technicians] = await Promise.all([
        getAll("projects"),
        getAll("documents"),
        getAll("technicians"),
      ]);

      list = list.filter(flag => {
        let flagContractorId: number | null = null;
        if (flag.targetType === "project") {
          const project = (projects as Record<string, unknown>[]).find((p) => (p.id as number) === flag.targetId);
          flagContractorId = project ? (project.contractorId as number | null) : null;
        } else if (flag.targetType === "document") {
          const doc = (documents as Record<string, unknown>[]).find((d) => (d.id as number) === flag.targetId);
          flagContractorId = doc ? (doc.contractorId as number | null) : null;
        } else if (flag.targetType === "technician") {
          const tech = (technicians as Record<string, unknown>[]).find((t) => (t.id as number) === flag.targetId);
          flagContractorId = tech ? ((tech.contractorId as number | null) || null) : null;
        }
        return flagContractorId === Number(activeContractorId);
      });
    }

    // Server-side standard filter
    if (standardFilter) {
      list = list.filter(flag => flag.standard === standardFilter);
    }

    // Server-side severity filter
    if (severityFilter) {
      list = list.filter(flag => flag.severity === severityFilter);
    }

    // Server-side status filter
    if (statusFilter) {
      list = list.filter(flag => flag.status === statusFilter);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch flags";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
