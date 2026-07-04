import { DailyNote } from "../types";
import { getAll, getWhere, updateWhere, insert } from "../lib";

export async function getAllDailyNotes(): Promise<DailyNote[]> {
  return await getAll<DailyNote>("dailyNotes");
}

export async function getDailyNote(
  projectId: number,
  date: string
): Promise<DailyNote | null> {
  const rows = await getWhere(
    "dailyNotes",
    "projectId = ? AND date = ?",
    [projectId, date]
  );
  return (rows[0] as unknown as DailyNote | undefined) || null;
}

export async function upsertDailyNote(
  projectId: number,
  date: string,
  hazard: string,
  solution: string,
  aiScore?: number | null,
  aiMissedItems?: string[] | null
): Promise<DailyNote> {
  const existing = await getDailyNote(projectId, date);
  const now = new Date().toISOString();

  if (existing) {
    await updateWhere(
      "dailyNotes",
      {
        hazard,
        solution,
        updatedAt: now,
        ...(aiScore !== undefined ? { aiScore } : {}),
        ...(aiMissedItems !== undefined ? { aiMissedItems } : {}),
        ...(aiScore !== undefined ? { aiAnalyzedAt: now } : {}),
      },
      "projectId = ? AND date = ?",
      [projectId, date]
    );
    return {
      ...existing,
      hazard,
      solution,
      updatedAt: now,
      aiScore: aiScore !== undefined ? aiScore : existing.aiScore,
      aiMissedItems: aiMissedItems !== undefined ? aiMissedItems : existing.aiMissedItems,
      aiAnalyzedAt: aiScore !== undefined ? now : existing.aiAnalyzedAt,
    };
  }

  const id = await insert("dailyNotes", {
    projectId,
    date,
    hazard,
    solution,
    updatedAt: now,
    aiScore: aiScore ?? null,
    aiMissedItems: aiMissedItems ?? null,
    aiAnalyzedAt: aiScore !== undefined ? now : null,
  });
  return {
    id,
    projectId,
    date,
    hazard,
    solution,
    updatedAt: now,
    aiScore: aiScore ?? null,
    aiMissedItems: aiMissedItems ?? null,
    aiAnalyzedAt: aiScore !== undefined ? now : null,
  };
}
