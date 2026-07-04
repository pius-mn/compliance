import { NextResponse } from "next/server";
import { getMilestones } from "../../../../services/milestones";
import { getProjects } from "../../../../services/projects";
import { requireAuth } from "../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);
    const projectIdFilter = url.searchParams.get("projectId");
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");

    let list = await getMilestones();
    if (!user.isCentral) {
      const projects = await getProjects();
      const authorizedProjectIds = projects
        .filter(p => p.contractorId === user.contractorId)
        .map(p => p.id);
      list = list.filter(m => authorizedProjectIds.includes(m.projectId));
    }

    // Optional project-level filter
    if (projectIdFilter) {
      const pid = Number(projectIdFilter);
      if (!isNaN(pid)) {
        list = list.filter(m => m.projectId === pid);
      }
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
    const message = error instanceof Error ? error.message : "Failed to fetch milestones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
