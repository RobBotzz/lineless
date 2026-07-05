import { useEffect, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';

import { AlertDialog } from '@/components/feedback';
import {
  cancelPendingOrderAuthorization,
  type CardOrderResult,
  createCardOrder,
  getAttendeeOrder,
  InsufficientStockError,
} from '@/api/orders';
import { ApiError } from '@/api/client';
import { createTab, getTabStatus } from '@/api/tabs';
import { clearAttendeeTab, getAttendeeTab, setAttendeeTab } from '@/auth/keychain';
import type { Order, OrderItemView } from '@/types/order';
import type { TabView } from '@/types/tab';
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

type PendingOrderResolution = 'none' | 'cancelled' | 'completed';

// The tab only flips to OPEN once Stripe's authorization webhook reaches the
// backend, so we poll briefly after each card confirmation.
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 20; // ~30s, covers normal webhook latency
const ORDER_REQUEST_TIMEOUT_MS = 20_000;

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
      if (cancelled.current) throw new CancelledError();
      const tab = await getTabStatus(tabId, eventId);
      if (cancelled.current) throw new CancelledError();
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

  // A failed request does not tell us whether the server processed it. Resolve
  // that ambiguity before another checkout can create a new order/requestId.
  async function reconcilePendingOrder(): Promise<PendingOrderResolution> {
    const orderId = pendingOrderId.current;
    if (!orderId) return 'none';

    try {
      const order = await getAttendeeOrder(orderId, eventId);
      if (order.paidAt) {
        pendingOrderId.current = null;
        onSuccess(order);
        return 'completed';
      }
    } catch {
      // The status read is best-effort. Cancellation remains safe: the backend
      // rejects paid orders and is idempotent for an already-cancelled order.
    }

    await cancelPendingAuthorization();
    requestId.current = crypto.randomUUID();
    return 'cancelled';
  }

  async function createOrderWithTimeout(tabId: string): Promise<CardOrderResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ORDER_REQUEST_TIMEOUT_MS);
    try {
      return await createCardOrder(eventId, items, tabId, requestId.current, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Placing the order timed out. Please retry.', { cause: error });
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  // Returns the id of an OPEN tab, opening + authorizing a new one if the stored
  // tab is missing or no longer usable.
  async function ensureOpenTab(): Promise<string> {
    const existing = getAttendeeTab(eventId);
    if (existing) {
      let tab: TabView | null = null;
      try {
        tab = await getTabStatus(existing.tabId, eventId);
      } catch (err) {
        // A 404 means the stored pointer is stale (a legacy tab, a tab from a
        // different event, or one the backend removed). Drop it and open a
        // fresh tab below. Any other error is real and must NOT be masked by
        // silently replacing the tab — that could orphan a live hold.
        if (err instanceof ApiError && err.status === 404) {
          clearAttendeeTab(eventId);
        } else {
          throw err;
        }
      }
      if (tab) {
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
    }

    const firstOrderCents = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const { tabId, clientSecret } = await createTab(eventId, firstOrderCents);
    if (cancelled.current) throw new CancelledError();
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
      const pendingResolution = await reconcilePendingOrder();
      if (pendingResolution === 'completed') return;

      const tabId = await ensureOpenTab();
      if (cancelled.current) throw new CancelledError();
      setMessage('Placing your order…');

      creatingOrder.current = true;
      setIsCreatingOrder(true);
      const result = await createOrderWithTimeout(tabId);
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
      let cleanupFailed = false;
      if (abandonedOrder) {
        try {
          const pendingResolution = await reconcilePendingOrder();
          if (pendingResolution === 'completed') return;
        } catch {
          cleanupFailed = true;
        }
      }
      if (cancelled.current) return;
      if (err instanceof InsufficientStockError) {
        onStockConflict(err);
        return;
      }
      setError(
        cleanupFailed
          ? 'We could not confirm the previous order status. Retry to safely resume checkout.'
          : err instanceof Error
            ? err.message
            : 'Payment failed. Please try again.',
      );
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
        onAcknowledge={handleRetry}
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
