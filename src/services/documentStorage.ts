import fs from "fs";
import path from "path";

function getUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "documents");
}

/**
 * Save a base64-encoded file to the filesystem and return its public URL path.
 *
 * For new documents (no docId yet), saves to a temp directory first.
 * For existing documents (update), saves directly to the final location.
 *
 * Returns the public URL path (e.g. /uploads/documents/5/filename.pdf).
 */
export function saveDocumentFile(
  base64DataUrl: string,
  fileName: string,
  docId?: number
): string {
  // Extract MIME type and base64 content
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  let buffer: Buffer;

  if (matches) {
    const base64Content = matches[2];
    buffer = Buffer.from(base64Content, "base64");
  } else {
    // Not a data URL — might be raw base64
    buffer = Buffer.from(base64DataUrl, "base64");
  }

  // Determine directory
  let docDir: string;
  if (docId) {
    docDir = path.join(getUploadsDir(), String(docId));
  } else {
    docDir = path.join(getUploadsDir(), "temp");
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  // Sanitize filename: keep only safe characters
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(docDir, safeName);

  // Write file
  fs.writeFileSync(filePath, buffer);

  if (docId) {
    return `/uploads/documents/${docId}/${safeName}`;
  }
  return `/uploads/documents/temp/${safeName}`;
}

/**
 * Move a temp file to its final document directory once the docId is known.
 */
export function moveToFinalPath(
  tempPath: string,
  docId: number,
  fileName: string
): string {
  const relativePath = tempPath.replace(/^\//, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  const docDir = path.join(getUploadsDir(), String(docId));
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalPath = path.join(docDir, safeName);

  if (fs.existsSync(absolutePath)) {
    fs.renameSync(absolutePath, finalPath);
  }

  return `/uploads/documents/${docId}/${safeName}`;
}

/**
 * Delete a document file from disk given its public URL path.
 */
export function deleteDocumentFile(filePath: string): void {
  if (!filePath || filePath.startsWith("data:")) return;
  const relativePath = filePath.replace(/^\//, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch {
    // File may already be missing — ignore
  }
}
