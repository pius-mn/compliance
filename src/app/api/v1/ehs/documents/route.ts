import { NextResponse } from "next/server";
import { getEHSDocuments, uploadEHSDocument } from "@/src/services/ehs";
import { requireAuth } from "@/src/lib/routeAuth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");
    const statusFilter = searchParams.get("status");
    const sortBy = searchParams.get("sort");

    let list = await getEHSDocuments();
    if (!user.isCentral) {
      list = list.filter(d => d.contractorId === user.contractorId);
    }

    // Filter by status if provided
    if (statusFilter) {
      list = list.filter(d => d.status.startsWith(statusFilter));
    }

    // Sort by upload date descending (newest first) if requested
    if (sortBy === "uploadDate") {
      list = [...list].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }

    const page = pageStr ? parseInt(pageStr, 10) : NaN;
    const limit = limitStr ? parseInt(limitStr, 10) : NaN;

    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const startIndex = (page - 1) * limit;
      const paginatedSlice = list.slice(startIndex, startIndex + limit);
      
      const response = NextResponse.json(paginatedSlice);
      response.headers.set("X-Total-Count", list.length.toString());
      response.headers.set("X-Page", page.toString());
      response.headers.set("X-Limit", limit.toString());
      return response;
    }

    return NextResponse.json(list);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  try {
    const payload = await req.json();
    const newDoc = await uploadEHSDocument(payload, user);
    return NextResponse.json(newDoc);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload document";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
