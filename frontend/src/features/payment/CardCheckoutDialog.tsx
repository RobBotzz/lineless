import { Elements } from '@stripe/react-stripe-js';

import { AlertDialog } from '@/components/feedback';
import { type InsufficientStockError } from '@/api/orders';
import type { Order, OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { CardPaymentForm } from './CardPaymentForm';
import { stripePromise } from './stripe';
import { useCardCheckout } from './useCardCheckout';

interface CardCheckoutDialogProps {
  eventId: string;
  items: OrderItemView[];
  onSuccess: (order: Order) => void;
  onClose: () => void;
  onStockConflict: (error: InsufficientStockError) => void;
}

// Renders the card-checkout UI (spinner / card prompt / error dialog) for the
// state useCardCheckout drives. Mounted only while a card checkout is in
// progress.
export function CardCheckoutDialog({
  eventId,
  items,
  onSuccess,
  onClose,
  onStockConflict,
}: CardCheckoutDialogProps) {
  const {
    phase,
    message,
    prompt,
    promptError,
    error,
    isCreatingOrder,
    onCardConfirmed,
    onCardError,
    onCancel,
    onRetry,
  } = useCardCheckout({ eventId, items, onSuccess, onStockConflict });

  function handleCancel(): void {
    onCancel();
    onClose();
  }

  // Failures use the shared alert so this matches the app's other popups.
  if (phase === 'error') {
    return (
      <AlertDialog
        message={error}
        title="Payment couldn't be completed"
        variant="danger"
        cancelLabel="Cancel"
        onCancel={handleCancel}
        acknowledgeLabel="Try again"
        onAcknowledge={onRetry}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
    >
      <section
        aria-modal="true"
        role="dialog"
        aria-label="Card payment"
        className="flex max-h-[calc(100dvh-4rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
      >
        {/* Header stays put; only the body scrolls, so the close button and
            title remain reachable when the Stripe element grows tall. */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text">Card payment</h2>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCreatingOrder}
            aria-label="Cancel payment"
            className="text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {prompt ? (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                {prompt.amountCents != null
                  ? `€${formatMoney(prompt.amountCents)} will be held on your card now. You're only charged for what you order, and the rest is released.`
                  : "Your card is only held now. You're charged after the event."}
              </p>
              {promptError && <p className="text-sm text-danger">{promptError}</p>}
              <Elements
                key={prompt.clientSecret}
                stripe={stripePromise}
                options={{ clientSecret: prompt.clientSecret }}
              >
                <CardPaymentForm
                  onConfirmed={onCardConfirmed}
                  onError={onCardError}
                  submitLabel={prompt.label}
                />
              </Elements>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"
                aria-hidden
              />
              <p className="text-sm text-text-muted">{message}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
