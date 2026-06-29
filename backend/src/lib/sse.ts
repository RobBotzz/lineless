import type { Response } from "express";

// A single Server-Sent Events connection. Owns the SSE wire framing, a keep-alive
// heartbeat (proxies and load balancers drop idle sockets) and disconnect cleanup.
// Transport only — it knows nothing about the domain it streams.
export class SseConnection {
  private readonly heartbeat: NodeJS.Timeout;

  constructor(private readonly res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // stop nginx from buffering the stream
    });
    res.flushHeaders(); // make the client's onopen fire immediately

    this.heartbeat = setInterval(() => this.comment("keep-alive"), 25_000);
  }

  // Send a named event carrying a JSON payload.
  send(event: string, data: unknown): void {
    // Newlines in the event name would corrupt SSE framing.
    const safeEvent = event.replace(/[\r\n]/g, "");
    this.res.write(`event: ${safeEvent}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // A comment line (": ...") — ignored by the client, used as a heartbeat.
  comment(text: string): void {
    this.res.write(`: ${text}\n\n`);
  }

  // Register cleanup; runs when the client closes the tab or the socket drops.
  onClose(cleanup: () => void): void {
    this.res.on("close", () => {
      clearInterval(this.heartbeat);
      cleanup();
      this.res.end();
    });
  }
}
