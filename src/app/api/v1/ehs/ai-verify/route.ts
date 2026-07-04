import { NextResponse } from "next/server";
import { processEHSDocument } from "@/src/services/ai_document_processor";
import { getAuthenticatedUser } from "@/src/lib/auth";

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { documentText, type, fileBase64, fileMimeType, technicianName } = await req.json();
    if (!documentText && !fileBase64) {
      return NextResponse.json(
        { error: "Document text content or file content is required for AI compliance verification." },
        { status: 400 }
      );
    }

    const result = await processEHSDocument(
      documentText || "",
      type || "PPE Audit",
      fileBase64,
      fileMimeType,
      technicianName
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("AI verify endpoint failed:", error);
    return NextResponse.json({ error: "AI document processing failure." }, { status: 500 });
  }
}
