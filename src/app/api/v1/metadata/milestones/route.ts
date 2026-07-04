import { NextResponse } from "next/server";
import { PREDEFINED_MILESTONES } from "@/src/services/milestones";

export async function GET() {
  return NextResponse.json(PREDEFINED_MILESTONES || []);
}
