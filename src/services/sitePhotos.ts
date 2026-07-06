import fs from "fs";
import path from "path";
import { SitePhoto, User } from "../types";
import { getAll, getById, insert, remove } from "../lib";
import { isSafaricomRole } from "../lib/permissions";

function getUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads", "site-photos");
}

/**
 * Decode a base64 data URL, determine the file extension, and write the
 * image to public/uploads/site-photos/{projectId}/{unique}.{ext}.
 * Returns the public URL path (e.g. /uploads/site-photos/3/1712345678901-abc.jpg).
 */
function saveBase64ToDisk(base64DataUrl: string, projectId: number): string {
  // Extract MIME type and base64 content
  const matches = base64DataUrl.match(/^data:(image\/[\w-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid base64 image data");
  }
  const mime = matches[1];
  const base64Content = matches[2];

  // Map MIME type to file extension
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  const ext = extMap[mime] || "jpg";

  // Create project subdirectory if it doesn't exist
  const projectDir = path.join(getUploadsDir(), String(projectId));
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Unique filename: timestamp-rand.xxx
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `${Date.now()}-${random}.${ext}`;
  const filePath = path.join(projectDir, fileName);

  // Decode and write
  const buffer = Buffer.from(base64Content, "base64");
  fs.writeFileSync(filePath, buffer);

  // Return the public URL path
  return `/uploads/site-photos/${projectId}/${fileName}`;
}

/**
 * Delete a file from disk given its public URL path.
 */
function deleteFileFromDisk(photoPath: string): void {
  if (!photoPath || photoPath.startsWith("data:")) return; // skip old base64 entries
  // photoPath is like /uploads/site-photos/3/file.jpg
  // Strip leading slash so path.join doesn't treat it as an absolute segment
  const relativePath = photoPath.replace(/^\//, "");
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch {
    // File may already be missing — ignore
  }
}

export async function getSitePhotos(): Promise<SitePhoto[]> {
  return await getAll<SitePhoto>("sitePhotos");
}

export async function uploadSitePhoto(
  projectId: number,
  photoData: string, // base64 data URL from client
  description: string,
  currentUser: User
): Promise<SitePhoto> {
  const project = await getById<Record<string, unknown>>("projects", projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // Security check: is user undertaking project?
  const isCentral = currentUser.isCentral;
  const isTechnicianOk = currentUser.role === "Field Technician" && Array.isArray(project.assignedTechnicianIds) && project.assignedTechnicianIds.includes(currentUser.id);
  const isContractorOk = project.contractorId === currentUser.contractorId;

  const isAuthorized = isCentral || isSafaricomRole(currentUser.role) || isTechnicianOk || isContractorOk;
  if (!isAuthorized) {
    throw new Error("Permission denied. You are not undertaking this project.");
  }

  // Save image to disk, get the public URL path
  const photoPath = saveBase64ToDisk(photoData, projectId);

  const id = await insert("sitePhotos", {
    projectId,
    uploadedByUserId: currentUser.id,
    uploadedByUserName: currentUser.name,
    contractorId: currentUser.contractorId || 0,
    photoData: photoPath,
    uploadDate: new Date().toISOString(),
    description
  });

  const newPhoto: SitePhoto = {
    id,
    projectId,
    uploadedByUserId: currentUser.id,
    uploadedByUserName: currentUser.name,
    contractorId: currentUser.contractorId || 0,
    photoData: photoPath,
    uploadDate: new Date().toISOString(),
    description
  };

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Site Photo Uploaded",
    category: "EHS Compliance",
    details: `Uploaded site photo for project ${projectId}: ${description}`,
    timestamp: new Date().toISOString(),
    contractorId: currentUser.contractorId
  });

  return newPhoto;
}

export async function deleteSitePhoto(
  id: number,
  currentUser: User
): Promise<void> {
  const photo = await getById<SitePhoto>("sitePhotos", id);
  if (!photo) {
    throw new Error("Photo not found");
  }

  const project = await getById<Record<string, unknown>>("projects", photo.projectId);
  if (!project) {
    throw new Error("Linked project not found");
  }

  // Security check: is user undertaking project?
  const isCentral = currentUser.isCentral;
  const isTechnicianOk = currentUser.role === "Field Technician" && Array.isArray(project.assignedTechnicianIds) && (project.assignedTechnicianIds as number[]).includes(currentUser.id);
  const isContractorOk = project.contractorId === currentUser.contractorId;

  const isAuthorized = isCentral || isSafaricomRole(currentUser.role) || isTechnicianOk || isContractorOk;
  if (!isAuthorized) {
    throw new Error("Permission denied. You are not undertaking the project for this site evidence.");
  }

  // Parse description to find linked milestone
  let milestoneId = "";
  if (photo.description && photo.description.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(photo.description);
      milestoneId = parsed.milestoneId || "";
    } catch {}
  }

  if (milestoneId) {
    const m = await getById<Record<string, unknown>>("milestones", Number(milestoneId));
    if (m) {
      const projectMilestones = await getAll<Record<string, unknown>>("milestones");
      const projectMiles = projectMilestones.filter((mil) => mil.projectId === m.projectId);
      const milestoneIndex = projectMiles.findIndex((x) => x.id === m.id);
      if (milestoneIndex !== -1 && milestoneIndex < projectMiles.length - 1) {
        throw new Error("Cannot delete photo associated with a locked milestone.");
      }
    }
  }

  // Delete the file from disk before removing the DB record
  deleteFileFromDisk(photo.photoData);

  await remove("sitePhotos", id);

  await insert("auditLogs", {
    userId: currentUser.id,
    userName: currentUser.name,
    userRole: currentUser.role,
    action: "Site Photo Deleted",
    category: "EHS Compliance",
    details: `Deleted site photo ${id}`,
    timestamp: new Date().toISOString(),
    contractorId: currentUser.contractorId
  });
}
