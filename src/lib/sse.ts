export interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  userId: string;
  contractorId: string | null;
  isCentral: boolean;
}

let sseClients: SSEClient[] = [];

export function registerSSEClient(client: SSEClient) {
  sseClients.push(client);
}

export function unregisterSSEClient(id: string) {
  sseClients = sseClients.filter(c => c.id !== id);
}

export function emitSSE(event: string, data: Record<string, unknown>, contractorIdParam: string | null = null) {
  const encoder = new TextEncoder();
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  
  sseClients.forEach(client => {
    const isAuthorized = client.isCentral || (contractorIdParam === null) || (client.contractorId === contractorIdParam);
    if (isAuthorized) {
      try {
        client.controller.enqueue(encoder.encode(payload));
      } catch {
        // Client stream is closed
      }
    }
  });
}
