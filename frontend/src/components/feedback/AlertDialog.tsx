import { useEffect } from 'react';
import { Button } from '../ui/button';
import { CheckIcon, WarningTriangleIcon } from '../icons';

interface AlertDialogProps {
  message: string | null;
  onAcknowledge: () => void;
  title?: string;
  acknowledgeLabel?: string;
  variant?: 'danger' | 'success';
  onCancel?: () => void;
  cancelLabel?: string;
}

export function AlertDialog({
  message,
  onAcknowledge,
  title = 'Something went wrong',
  acknowledgeLabel = 'Acknowledge',
  variant = 'danger',
  onCancel,
  cancelLabel = 'Cancel',
}: AlertDialogProps) {
  useEffect(() => {
    if (!message) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (onCancel) onCancel();
        else onAcknowledge();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [message, onAcknowledge, onCancel]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4 py-8"
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
          {variant === 'success' ? <CheckIcon className="h-8 w-8" /> : <WarningTriangleIcon />}
        </div>

        <h2 id="alert-dialog-title" className="mt-5 text-xl font-semibold text-text">
          {title}
        </h2>
        <p id="alert-dialog-message" className="mt-3 text-sm leading-6 text-text-muted">
          {message}
        </p>

        {onCancel ? (
          <div className="mt-6 flex gap-3">
            <Button className="flex-1" onClick={onCancel} size="lg" variant="secondary">
              {cancelLabel}
            </Button>
            <Button className="flex-1" onClick={onAcknowledge} size="lg">
              {acknowledgeLabel}
            </Button>
          </div>
        ) : (
          <Button className="mt-6 w-full rounded-lg" size="lg" onClick={onAcknowledge}>
            {acknowledgeLabel}
          </Button>
        )}
      </section>
    </div>
  );
}
