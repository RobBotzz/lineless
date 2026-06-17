import { useEffect, useRef, useState } from 'react';

import { ApiError, streamSse, type ApiAuthMode, type SseFrame } from '@/api/client';

export type SseStatus = 'idle' | 'connecting' | 'open' | 'error';

export interface SseMessage {
  event: string;
  data: unknown;
}

export interface UseSseOptions {
  path: string | null | undefined;
  auth: ApiAuthMode;
  standId?: string;
  eventId?: string;
  onMessage: (message: SseMessage) => void;
  enabled?: boolean;
}

export interface UseSseResult {
  status: SseStatus;
  error: Error | null;
}

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 15_000;

export function useSSE({
  auth,
  enabled = true,
  eventId,
  onMessage,
  path,
  standId,
}: UseSseOptions): UseSseResult {
  const [status, setStatus] = useState<SseStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const onMessageRef = useRef(onMessage);
  const active = enabled && Boolean(path);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!active || !path) return;

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
          eventId,
          signal: controller.signal,
          standId,
          onOpen: () => {
            backoff = BASE_RECONNECT_MS;
            setStatus('open');
            setError(null);
          },
          onMessage: (frame) => onMessageRef.current(toMessage(frame)),
        });

        scheduleReconnect();
      } catch (err) {
        if (stopped || controller.signal.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStatus('error');
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

  return active ? { status, error } : { status: 'idle', error: null };
}

function toMessage(frame: SseFrame): SseMessage {
  try {
    return { event: frame.event, data: JSON.parse(frame.data) };
  } catch {
    return { event: frame.event, data: frame.data };
  }
}
