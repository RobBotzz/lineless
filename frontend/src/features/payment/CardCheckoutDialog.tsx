import { useEffect, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';

import { Button } from '@/components/ui/button';
import {
  cancelPendingOrderAuthorization,
  createCardOrder,
  getAttendeeOrder,
  InsufficientStockError,
} from '@/api/orders';
import { createTab, getTabStatus } from '@/api/tabs';
import { clearAttendeeTab, getAttendeeTab, setAttendeeTab } from '@/auth/keychain';
import type { Order, OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { CardPaymentForm } from './CardPaymentForm';
import { stripePromise } from './stripe';

interface CardCheckoutDialogProps {
  eventId: string;
  items: OrderItemView[];
  onSuccess: (order: Order) => void;
  onClose: () => void;
  onStockConflict: (error: InsufficientStockError) => void;
}

interface CardPrompt {
  clientSecret: string;
  label: string;
  // Hold amount in cents, read back from Stripe for display. Null until the
  // PaymentIntent has been retrieved (or if the lookup fails).
  amountCents: number | null;
}

// The tab only flips to OPEN once Stripe's authorization webhook reaches the
// backend, so we poll briefly after each card confirmation.
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20; // ~30s, covers normal webhook latency

// Distinguishes a user-initiated cancel from a real failure so the runner can
// unwind silently instead of showing an error.
class CancelledError extends Error {}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Drives the whole card flow end to end: ensure an OPEN tab (opening one and
// authorizing the baseline hold if needed), place the order against it, and
// confirm a top-up authorization if the order exceeds the current hold. Mounted
// only while a card checkout is in progress, so it runs once on mount.
export function CardCheckoutDialog({
  eventId,
  items,
  onSuccess,
  onClose,
  onStockConflict,
}: CardCheckoutDialogProps) {
  const [phase, setPhase] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState('Setting up your payment…');
  const [prompt, setPrompt] = useState<CardPrompt | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Bridges the imperative card form into the linear async runner: the runner
  // sets a prompt and awaits this deferred; the form resolves it on success.
  const cardDeferred = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);
  const pendingOrderId = useRef<string | null>(null);
  const cancelled = useRef(false);
  const started = useRef(false);
  const creatingOrder = useRef(false);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runCheckout();
    // Run-once on mount; runCheckout closes over current props, which are fixed
    // for this dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function awaitCard(clientSecret: string, label: string): Promise<void> {
    setPromptError(null);
    setPrompt({ clientSecret, label, amountCents: null });
    // Read the real hold amount from Stripe (publishable-key safe) so the guest
    // sees exactly what will be authorized. Best-effort: the form still works if
    // the lookup fails, just without the figure.
    void stripePromise.then(async (stripe) => {
      const result = await stripe?.retrievePaymentIntent(clientSecret);
      const amountCents = result?.paymentIntent?.amount ?? null;
      setPrompt((current) =>
        current && current.clientSecret === clientSecret ? { ...current, amountCents } : current,
      );
    });
    return new Promise<void>((resolve, reject) => {
      cardDeferred.current = { resolve, reject };
    });
  }

  async function pollUntilOpen(tabId: string): Promise<void> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      const tab = await getTabStatus(tabId, eventId);
      if (tab.status === 'OPEN') return;
      if (tab.status === 'FAILED') throw new Error('Your card could not be authorized.');
      await delay(POLL_INTERVAL_MS);
    }
    throw new Error('Timed out waiting for your bank to authorize the card.');
  }

  async function cancelPendingAuthorization(): Promise<void> {
    const orderId = pendingOrderId.current;
    if (!orderId) return;

    await cancelPendingOrderAuthorization(orderId, eventId);
    if (pendingOrderId.current === orderId) pendingOrderId.current = null;
  }

  // Returns the id of an OPEN tab, opening + authorizing a new one if the stored
  // tab is missing or no longer usable.
  async function ensureOpenTab(): Promise<string> {
    const existing = getAttendeeTab(eventId);
    if (existing) {
      const tab = await getTabStatus(existing.tabId, eventId);
      if (tab.status === 'OPEN') return existing.tabId;
      // A tab mid-authorization may just be waiting on the webhook (e.g. the
      // card was confirmed but an earlier poll timed out). Re-poll before
      // abandoning it, so a confirmed hold isn't orphaned and duplicated as a
      // second card hold. Only discard once it proves unusable.
      if (tab.status === 'PENDING_AUTHORIZATION') {
        try {
          setMessage('Confirming authorization…');
          await pollUntilOpen(existing.tabId);
          return existing.tabId;
        } catch {
          // Never opened (declined, or the card was never confirmed) — fall
          // through and open a fresh tab below.
        }
      }
      clearAttendeeTab(eventId); // PAID / CHECKOUT_PENDING / FAILED / dead
    }

    const { tabId, clientSecret } = await createTab(eventId);
    setAttendeeTab(eventId, tabId);
    setMessage('Authorizing your card…');
    await awaitCard(clientSecret, 'Authorize card');
    setPrompt(null);
    setMessage('Confirming authorization…');
    await pollUntilOpen(tabId);
    return tabId;
  }

  async function runCheckout(): Promise<void> {
    try {
      const tabId = await ensureOpenTab();
      setMessage('Placing your order…');

      creatingOrder.current = true;
      setIsCreatingOrder(true);
      const result = await createCardOrder(eventId, items, tabId, requestId.current);
      // For top-ups, publish the cleanup id before making cancellation
      // available again. This closes the response/close race that could leave
      // a reserved order and Stripe hold behind.
      if (result.status === 'authorizationRequired') {
        pendingOrderId.current = result.orderId;
      }
      creatingOrder.current = false;
      setIsCreatingOrder(false);

      if (result.status === 'created') {
        if (cancelled.current) return;
        onSuccess(result.order);
        return;
      }

      // The order exceeded the current hold; the backend already created it
      // (gated) and needs a top-up authorization to release it.
      setMessage('A little more authorization is needed…');
      await awaitCard(result.clientSecret, 'Authorize remaining amount');
      setPrompt(null);
      setMessage('Confirming authorization…');
      await pollUntilOpen(tabId);
      const order = await getAttendeeOrder(result.orderId, eventId);
      pendingOrderId.current = null;
      if (cancelled.current) return;
      onSuccess(order);
    } catch (err) {
      creatingOrder.current = false;
      setIsCreatingOrder(false);
      if (err instanceof CancelledError) return;
      const abandonedOrder = pendingOrderId.current !== null;
      await cancelPendingAuthorization().catch(() => undefined);
      if (cancelled.current) return;
      if (err instanceof InsufficientStockError) {
        onStockConflict(err);
        return;
      }
      if (abandonedOrder) requestId.current = crypto.randomUUID();
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setPhase('error');
    }
  }

  function handleCardConfirmed(): void {
    cardDeferred.current?.resolve();
    cardDeferred.current = null;
  }

  // Card-level failures (declines) keep the form mounted so the user can fix the
  // card and resubmit the same PaymentIntent — we only show the message.
  function handleCardError(msg: string): void {
    setPromptError(msg);
  }

  function handleCancel(): void {
    if (creatingOrder.current) return;
    cancelled.current = true;
    cardDeferred.current?.reject(new CancelledError());
    cardDeferred.current = null;
    void cancelPendingAuthorization().catch(() => undefined);
    onClose();
  }

  function handleRetry(): void {
    setError(null);
    setPromptError(null);
    setPhase('working');
    setMessage('Setting up your payment…');
    void runCheckout();
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
          {phase === 'error' ? (
            <div className="space-y-4">
              <p className="text-sm text-danger">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            </div>
          ) : prompt ? (
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
                  onConfirmed={handleCardConfirmed}
                  onError={handleCardError}
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
