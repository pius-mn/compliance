import { NextResponse } from "next/server";
import { getSitePhotos, uploadSitePhoto } from "../../../../services/sitePhotos";
import { getProjects } from "../../../../services/projects";
import { requireAuth } from "../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const url = new URL(req.url);
    const projectIdStr = url.searchParams.get("projectId");
    const projectId = projectIdStr ? Number(projectIdStr) : undefined;
    const dateFilter = url.searchParams.get("date");
    const pageStr = url.searchParams.get("page");
    const limitStr = url.searchParams.get("limit");

    let list = await getSitePhotos();
    const projects = await getProjects();

    // Determine which projects the user is authorized to see
    let authorizedProjects = projects;
    if (!user.isCentral) {
      authorizedProjects = authorizedProjects.filter(p => p.contractorId === user.contractorId);
    }
    if (user.role === "Field Technician") {
      authorizedProjects = authorizedProjects.filter(p => p.assignedTechnicianIds?.includes(user.id));
    }
    const authorizedProjectIds = authorizedProjects.map(p => p.id);

    // Filter list of photos
    list = list.filter(p => authorizedProjectIds.includes(p.projectId));

    if (projectId !== undefined) {
      if (!authorizedProjectIds.includes(projectId)) {
        return NextResponse.json(
          { error: "Permission denied. You do not have access to this project's site evidence." },
          { status: 403 }
        );
      }
      list = list.filter(p => p.projectId === projectId);
    }

    // Date filter: match by uploadDate prefix (YYYY-MM-DD) or date in description JSON
    if (dateFilter) {
      list = list.filter(p => {
        if (p.uploadDate && p.uploadDate.startsWith(dateFilter)) return true;
        if (p.description && p.description.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(p.description);
            if (parsed.date === dateFilter) return true;
          } catch {}
        }
        return false;
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch site photos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { projectId, photoData, description } = await req.json();
    if (!projectId || !photoData || !description) {
      return NextResponse.json(
        { error: "ProjectId, photoData, and description are required" },
        { status: 400 }
      );
    }

    const newPhoto = await uploadSitePhoto(Number(projectId), photoData, description, user);
    return NextResponse.json(newPhoto);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload site photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
