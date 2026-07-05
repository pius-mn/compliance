import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getById } from "@/src/lib";
import { requireAuth } from "@/src/lib/routeAuth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const resolvedParams = await params;
    const docId = Number(resolvedParams.id);
    if (isNaN(docId)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const doc = await getById<Record<string, unknown>>("documents", docId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Security: contractor isolation
    if (!user.isCentral && doc.contractorId !== user.contractorId) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const filePath = doc.file_path as string | null;
    if (!filePath) {
      return NextResponse.json({ error: "No file stored for this document" }, { status: 404 });
    }

    // Resolve absolute path from public URL path
    const relativePath = filePath.replace(/^\//, "");
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const buffer = fs.readFileSync(absolutePath);
    const fileName = doc.fileName as string || "document";

    // Determine content type from file extension
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to serve document file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
