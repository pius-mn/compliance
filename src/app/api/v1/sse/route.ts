import { registerSSEClient, unregisterSSEClient, SSEClient } from "@/src/lib/sse";
import { getAuthenticatedUser } from "@/src/lib/auth";
import { startComplianceScanner } from "@/src/lib/serverLifecycle";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await startComplianceScanner();

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: SSE Connected\n\n"));

      const sseClient: SSEClient = {
        id: clientId,
        controller,
        userId: String(user.id),
        contractorId: user.contractorId !== null ? String(user.contractorId) : null,
        isCentral: !!user.isCentral
      };

      registerSSEClient(sseClient);
    },
    cancel() {
      unregisterSSEClient(clientId);
    }
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
