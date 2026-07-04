import { NextResponse } from "next/server";
import { analyzeHazardSolution } from "../../../../../services/ai_hazard_analyzer";
import { requireAuth } from "../../../../../lib/routeAuth";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const { hazard, solution } = await req.json();
    if (!hazard?.trim() && !solution?.trim()) {
      return NextResponse.json(
        { error: "Hazard or solution description is required for AI analysis." },
        { status: 400 }
      );
    }

    const result = await analyzeHazardSolution(hazard || "", solution || "");
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Hazard analysis endpoint failed:", error);
    return NextResponse.json({ error: "AI hazard analysis failed." }, { status: 500 });
  }
}
