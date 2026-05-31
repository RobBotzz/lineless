import { useEffect } from 'react';
import { Button } from '../ui/button';

interface AlertDialogProps {
  message: string | null;
  onAcknowledge: () => void;
  title?: string;
  acknowledgeLabel?: string;
  variant?: 'danger' | 'success';
}

export function AlertDialog({
  message,
  onAcknowledge,
  title = 'Something went wrong',
  acknowledgeLabel = 'Acknowledge',
  variant = 'danger',
}: AlertDialogProps) {
  useEffect(() => {
    if (!message) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onAcknowledge();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [message, onAcknowledge]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
    >
      <section
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-message"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
        role="alertdialog"
      >
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            variant === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {variant === 'success' ? <CheckIcon /> : <WarningTriangleIcon />}
        </div>

        <h2 id="alert-dialog-title" className="mt-5 text-xl font-semibold text-text">
          {title}
        </h2>
        <p id="alert-dialog-message" className="mt-3 text-sm leading-6 text-text-muted">
          {message}
        </p>

        <Button className="mt-6 w-full rounded-lg" size="lg" onClick={onAcknowledge}>
          {acknowledgeLabel}
        </Button>
      </section>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function WarningTriangleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M10.3 4.2 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
