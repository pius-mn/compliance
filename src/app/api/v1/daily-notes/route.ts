import { NextResponse } from "next/server";
import { getDailyNote, getAllDailyNotes, upsertDailyNote } from "../../../../services/dailyNotes";
import { getAll as getAllProjects } from "../../../../lib";
import { requireAuth } from "../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const projectId = Number(url.searchParams.get("projectId"));
    const date = url.searchParams.get("date");

    // If both projectId and date are provided, return a single note
    if (projectId && date) {
      const note = await getDailyNote(projectId, date);
      return NextResponse.json(note || { projectId, date, hazard: "", solution: "" });
    }

    // Otherwise return all notes with project names
    const notes = await getAllDailyNotes();
    const projects = await getAllProjects<Record<string, unknown>>("projects");

    const enriched = notes.map(note => {
      const project = projects.find((p: Record<string, unknown>) => p.id === note.projectId);
      return {
        ...note,
        projectName: project?.name || `Project #${note.projectId}`,
        contractorId: project?.contractorId || null,
      };
    });

    // Sort by date descending (newest first)
    enriched.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch daily notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { projectId, date, hazard, solution, aiScore, aiMissedItems } = await req.json();
    if (!projectId || !date) {
      return NextResponse.json(
        { error: "projectId and date are required" },
        { status: 400 }
      );
    }

    const note = await upsertDailyNote(
      projectId,
      date,
      hazard || "",
      solution || "",
      aiScore != null ? Number(aiScore) : undefined,
      aiMissedItems != null ? aiMissedItems : undefined
    );
    return NextResponse.json(note);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save daily note";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
