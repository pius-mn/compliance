import { NextResponse } from "next/server";
import { PREDEFINED_PREREQUISITES } from "@/src/services/milestones";

export async function GET() {
  return NextResponse.json(PREDEFINED_PREREQUISITES || []);
}
