import { NextResponse } from "next/server";
import { getMilestones, createProjectMilestone } from "../../../../../../services/milestones";
import { getProjects } from "../../../../../../services/projects";
import { requireAuth } from "../../../../../../lib/routeAuth";
import { guardContractorAccess } from "../../../../../../lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const projectId = Number(resolvedParams.id);

    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    try {
      guardContractorAccess(user, project.contractorId, "project");
    } catch {
      return NextResponse.json({ error: "Permission denied for this project data." }, { status: 403 });
    }

    const list = await getMilestones();
    const projectMilestones = list.filter(m => m.projectId === projectId);
    return NextResponse.json(projectMilestones);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch project milestones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const projectId = Number(resolvedParams.id);
    const body = await req.json();

    const newMilestone = await createProjectMilestone(projectId, body, user);
    return NextResponse.json(newMilestone);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to add milestone";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
