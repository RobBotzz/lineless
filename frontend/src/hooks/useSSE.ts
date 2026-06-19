import { useEffect, useRef, useState } from 'react';

import { ApiError, streamSse, type ApiAuthMode, type SseFrame } from '@/api/client';

export type SseStatus = 'idle' | 'connecting' | 'open' | 'error';

// A decoded frame with its `data:` payload already JSON-parsed (non-JSON payloads
// pass through as the raw string).
export interface SseMessage {
  event: string;
  data: unknown;
}

export interface UseSseOptions {
  // The stream path. null/undefined disables the connection (e.g. while a required
  // scope id is still missing) — handy for conditional streams.
  path: string | null | undefined;
  auth: ApiAuthMode;
  standId?: string;
  eventId?: string;
  // Invoked for every frame. Does not need to be stable — it is read through a ref,
  // so changing it never tears down the connection.
  onMessage: (message: SseMessage) => void;
  // Set false to keep the stream closed without unmounting the consumer.
  enabled?: boolean;
}

export interface UseSseResult {
  status: SseStatus;
  error: Error | null;
}

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 15_000;

// React lifecycle wrapper around streamSse: tracks connection status, reconnects
// with exponential backoff after a drop or a clean server-side close, and tears
// the connection down on unmount or when the target changes. Auth, refresh and
// 401 handling live in the transport (see streamSse) — this hook only owns the
// React-facing concerns. Loaders/TanStack Query stay for one-shot reads; this is
// strictly for live streams (see the data-fetching split in CLAUDE.md).
export function useSSE({
  path,
  auth,
  standId,
  eventId,
  onMessage,
  enabled = true,
}: UseSseOptions): UseSseResult {
  const [status, setStatus] = useState<SseStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Latest callback without retriggering the connect effect on every render.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const active = enabled && !!path;

  useEffect(() => {
    if (!active || !path) return; // inactive — status is derived as 'idle' below

    const controller = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = BASE_RECONNECT_MS;
    let stopped = false;

    const scheduleReconnect = () => {
      if (stopped) return;
      reconnectTimer = setTimeout(() => void connect(), backoff);
      backoff = Math.min(backoff * 2, MAX_RECONNECT_MS);
    };

    const connect = async () => {
      if (stopped) return;
      setStatus('connecting');

      try {
        await streamSse(path, {
          auth,
          standId,
          eventId,
          signal: controller.signal,
          onOpen: () => {
            backoff = BASE_RECONNECT_MS; // healthy connection — reset the backoff
            setStatus('open');
            setError(null);
          },
          onMessage: (frame) => onMessageRef.current(toMessage(frame)),
        });

        // Clean end (server restart / proxy timeout). Reconnect — the next snapshot
        // arrives as the stream's first frame, so no state is lost.
        scheduleReconnect();
      } catch (err) {
        if (stopped || controller.signal.aborted) return; // intentional close
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
        // A 401 means the credential is gone; the transport already routed it to
        // the 401 handler. Reconnecting would only loop, so stop here.
        if (err instanceof ApiError && err.status === 401) return;
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      stopped = true;
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [active, path, auth, standId, eventId]);

  // While inactive the connection is torn down, so report a clean idle state
  // rather than a stale 'open'/'error' left over from the last active session.
  return active ? { status, error } : { status: 'idle', error: null };
}

function toMessage(frame: SseFrame): SseMessage {
  try {
    return { event: frame.event, data: JSON.parse(frame.data) };
  } catch {
    return { event: frame.event, data: frame.data };
  }
}
