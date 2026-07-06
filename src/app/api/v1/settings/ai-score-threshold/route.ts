import { NextResponse } from "next/server";
import { getSetting, setSetting, insert } from "../../../../../lib";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const value = await getSetting("aiScoreThreshold");
    return NextResponse.json({
      threshold: value ? Number(value) : 50,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { threshold } = await req.json();
    if (threshold == null || typeof threshold !== "number" || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: "Threshold must be a number between 0 and 100" },
        { status: 400 }
      );
    }

    // Read the old threshold for audit logging
    const oldValue = await getSetting("aiScoreThreshold");
    const oldThreshold = oldValue ? Number(oldValue) : 50;
    const newThreshold = Math.round(threshold);

    await setSetting("aiScoreThreshold", String(newThreshold));

    // Audit log the change
    await insert("auditLogs", {
      userId: auth.user.id,
      userName: auth.user.name,
      userRole: auth.user.role,
      action: "AI Score Threshold Updated",
      category: "System",
      timestamp: new Date().toISOString(),
      details: `AI score threshold changed from ${oldThreshold}% to ${newThreshold}%`,
      contractorId: null,
    });

    // Notify all users of the change
    await insert("notifications", {
      userId: null,
      role: null,
      contractorId: null,
      title: "AI Score Threshold Updated",
      message: `AI score threshold changed from ${oldThreshold}% to ${newThreshold}% by ${auth.user.name}`,
      type: "info",
      createdAt: new Date().toISOString(),
      read: false,
    });

    return NextResponse.json({ threshold: newThreshold });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update setting";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
