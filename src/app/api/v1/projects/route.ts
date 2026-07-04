import { NextResponse } from "next/server";
import { getProjects, addProject } from "../../../../services/projects";
import { requireAuth } from "../../../../lib/routeAuth";
import { isTechnician } from "../../../../lib/permissions";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const statusFilter = url.searchParams.get("status") || "";
  const contractorFilterStr = url.searchParams.get("contractorId");
  const sortBy = url.searchParams.get("sortBy") || "";
  const sortDir = url.searchParams.get("sortDir") === "desc" ? -1 : 1;
  const pageStr = url.searchParams.get("page");
  const limitStr = url.searchParams.get("limit");

  let list = await getProjects();

  // Role-based filtering
  if (isTechnician(user.role)) {
    list = list.filter(p => p.assignedTechnicianIds?.includes(user.id));
  } else if (!user.isCentral) {
    list = list.filter(p => p.contractorId === user.contractorId);
  }

  // Additional filters
  if (search) {
    list = list.filter(p => p.name.toLowerCase().includes(search));
  }
  if (statusFilter) {
    list = list.filter(p => p.status === statusFilter);
  }
  if (contractorFilterStr) {
    const contractorId = Number(contractorFilterStr);
    if (!isNaN(contractorId)) {
      list = list.filter(p => p.contractorId === contractorId);
    }
  }

  // Server-side sorting
  if (sortBy) {
    list = [...list].sort((a, b) => {
      let valA: string | number = "", valB: string | number = "";
      switch (sortBy) {
        case "name":
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
          break;
        case "budget":
          valA = a.budget || 0;
          valB = b.budget || 0;
          break;
        case "startDate":
          valA = a.startDate || "";
          valB = b.startDate || "";
          break;
        case "endDate":
          valA = a.endDate || "";
          valB = b.endDate || "";
          break;
        case "status":
          valA = a.status || "";
          valB = b.status || "";
          break;
        default:
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
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

export async function POST(req: Request) {
  const auth = await requireAuth(req, {
    requireCentral: true,
    allowedRoles: ["Safaricom Admin", "Safaricom EHS Officer", "Safaricom Project Creator"],
  });
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const newProject = await addProject(body, user);
    return NextResponse.json(newProject);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
