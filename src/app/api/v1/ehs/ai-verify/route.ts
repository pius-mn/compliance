import { NextResponse } from "next/server";
import { processEHSDocument } from "@/src/services/ai_document_processor";
import { uploadEHSDocument } from "@/src/services/ehs";
import { getAuthenticatedUser } from "@/src/lib/auth";

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      documentText,
      type,
      fileBase64,
      fileMimeType,
      technicianName,
      technicianId,
      fileName,
      documentTypeId,
    } = await req.json();

    if (!documentText && !fileBase64) {
      return NextResponse.json(
        { error: "Document text content or file content is required for AI compliance verification." },
        { status: 400 }
      );
    }

    // Run AI verification
    const result = await processEHSDocument(
      documentText || "",
      type || "PPE Audit",
      fileBase64,
      fileMimeType,
      technicianName
    );

    // If AI verification passes (score >= 70, verifiedByAi = true), automatically
    // insert the document into the database using the AI-extracted expiry date.
    if (result.verifiedByAi && technicianId && fileName) {
      try {
        const newDoc = await uploadEHSDocument(
          {
            technicianId,
            type: type || "PPE Audit",
            fileName,
            documentTypeId: documentTypeId || null,
            verifiedByAi: result.verifiedByAi,
            expiryDate: result.expiryDate, // AI-extracted expiry date
            fileBase64: fileBase64, // Save file to disk
            fileMimeType: fileMimeType,
          },
          user
        );

        return NextResponse.json({
          ...result,
          documentInserted: true,
          document: newDoc,
        });
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : "Failed to register document";
        console.error("[AI Verify] Document insertion failed:", msg);
        return NextResponse.json({
          ...result,
          documentInserted: false,
          documentInsertError: msg,
        });
      }
    }

    // Verification failed or missing fields — return AI result without DB insert
    return NextResponse.json({
      ...result,
      documentInserted: false,
    });
  } catch (error: unknown) {
    console.error("AI verify endpoint failed:", error);
    return NextResponse.json({ error: "AI document processing failure." }, { status: 500 });
  }
}
