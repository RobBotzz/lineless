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

  // Send a named event carrying a JSON payload. A no-op once the response has
  // ended or the socket has been destroyed: callers routinely queue sends behind
  // an async lookup, and by the time it resolves the client may already be gone.
  // Writing to an ended response (writableEnded) — or one whose peer socket
  // dropped before our close handler ran res.end() (destroyed, writableEnded
  // still false) — throws asynchronously as an unhandled error and crashes the
  // process, so this is the one place that guards against it for every caller.
  send(event: string, data: unknown): void {
    if (this.res.writableEnded || this.res.destroyed) return;
    if (/[\r\n]/.test(event))
      throw new Error(
        `SSE event name must not contain newlines: ${JSON.stringify(event)}`
      );
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // A comment line (": ...") — ignored by the client, used as a heartbeat.
  comment(text: string): void {
    if (this.res.writableEnded || this.res.destroyed) return;
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
