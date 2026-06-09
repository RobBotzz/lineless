import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { ensureAttendeeSession, hasValidAttendeeSession } from '@/auth/attendeeSession';
import { subscribeAttendee } from '@/auth/keychain';

type SessionStatus = 'checking' | 'ready' | 'error';

export function RequireAttendeeSession({
  eventId,
  children,
}: {
  eventId: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<SessionStatus>(() =>
    hasValidAttendeeSession(eventId) ? 'ready' : 'checking',
  );

  useEffect(() => {
    let cancelled = false;

    async function ensure() {
      if (!hasValidAttendeeSession(eventId)) setStatus('checking');
      try {
        await ensureAttendeeSession(eventId);
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void ensure();

    // Re-run when the stored session changes (e.g. cleared by a 401 handler).
    const unsubscribe = subscribeAttendee(() => {
      if (!hasValidAttendeeSession(eventId)) void ensure();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-text-muted">
          Could not start a session for this event. Please reload the page.
        </p>
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-text-muted">Starting session…</p>
      </div>
    );
  }

  return children;
}
