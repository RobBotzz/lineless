import { useEffect, useRef, useState } from 'react';

import {
  cancelPendingOrderAuthorization,
  type CardOrderResult,
  createCardOrder,
  getAttendeeOrder,
  InsufficientStockError,
} from '@/api/orders';
import { ApiError } from '@/api/client';
import { createTab, getTabStatus } from '@/api/tabs';
import {
  clearAttendeeCheckout,
  clearAttendeeTab,
  getAttendeeCheckout,
  getAttendeeTab,
  setAttendeeCheckout,
  setAttendeeTab,
} from '@/auth/keychain';
import type { Order, OrderItemView } from '@/types/order';
import type { TabView } from '@/types/tab';

import { stripePromise } from './stripe';

interface UseCardCheckoutOptions {
  eventId: string;
  items: OrderItemView[];
  onSuccess: (order: Order) => void;
  onStockConflict: (error: InsufficientStockError) => void;
}

export interface CardPrompt {
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
export function useCardCheckout({
  eventId,
  items,
  onSuccess,
  onStockConflict,
}: UseCardCheckoutOptions) {
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
  // Idempotency key for this checkout, seeded lazily from persisted storage so a
  // Stripe 3DS redirect (which reloads the page and wipes React refs) resumes the
  // same order on return instead of creating a duplicate with a fresh key.
  const requestId = useRef<string | null>(null);

  // Stable signature of the cart, used to tell whether a persisted checkout key
  // still belongs to the current items. Sorted so array rehydration order after
  // a 3DS redirect does not produce a different fingerprint for the same cart.
  function cartFingerprint(): string {
    return items
      .map((i) => `${i.productId}:${i.quantity}:${i.comments.join('|')}`)
      .sort()
      .join(';');
  }

  function currentRequestId(): string {
    if (requestId.current) return requestId.current;
    const fingerprint = cartFingerprint();
    const stored = getAttendeeCheckout(eventId);
    requestId.current =
      stored && stored.fingerprint === fingerprint ? stored.requestId : crypto.randomUUID();
    setAttendeeCheckout(eventId, fingerprint, requestId.current);
    return requestId.current;
  }

  // A completed checkout must drop its persisted key so the next, different cart
  // starts a fresh order instead of replaying this one.
  function finishWithOrder(order: Order): void {
    clearAttendeeCheckout(eventId);
    requestId.current = null;
    onSuccess(order);
  }

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
        finishWithOrder(order);
        return 'completed';
      }
    } catch {
      // The status read is best-effort. Cancellation remains safe: the backend
      // rejects paid orders and is idempotent for an already-cancelled order.
    }

    await cancelPendingAuthorization();
    // The previous order is being abandoned; rotate to a fresh key (and persist
    // it) so the retry creates a new order rather than replaying the cancelled one.
    requestId.current = crypto.randomUUID();
    setAttendeeCheckout(eventId, cartFingerprint(), requestId.current);
    return 'cancelled';
  }

  async function createOrderWithTimeout(tabId: string): Promise<CardOrderResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ORDER_REQUEST_TIMEOUT_MS);
    try {
      return await createCardOrder(eventId, items, tabId, currentRequestId(), controller.signal);
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
        // Reuse an OPEN tab only while it still accepts orders. Past its freeze
        // window a tab stays OPEN so it can still settle, but the backend
        // rejects new orders against it — so treat it as spent and open a
        // replacement below instead of looping on a guaranteed rejection.
        if (tab.status === 'OPEN' && tab.acceptingOrders) return existing.tabId;
        // A tab mid-authorization may just be waiting on the webhook (e.g. the
        // card was confirmed but an earlier poll timed out). Re-poll before
        // abandoning it, so a confirmed hold isn't orphaned and duplicated as a
        // second card hold. Only discard once it proves unusable.
        if (tab.status === 'PENDING_AUTHORIZATION') {
          try {
            setMessage('Confirming authorization…');
            await pollUntilOpen(existing.tabId);
            // pollUntilOpen only waits for OPEN; a tab that crossed its 36h
            // freeze window while we were polling is OPEN but no longer accepts
            // orders. Re-check so we open a replacement instead of returning a
            // tab the backend will immediately reject.
            const opened = await getTabStatus(existing.tabId, eventId);
            if (opened.acceptingOrders) return existing.tabId;
          } catch {
            // Never opened (declined, or the card was never confirmed) — fall
            // through and open a fresh tab below.
          }
        }
        clearAttendeeTab(eventId); // PAID / CHECKOUT_PENDING / FAILED / frozen / dead
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
        finishWithOrder(result.order);
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
      finishWithOrder(order);
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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runCheckout();
    // Run-once on mount; runCheckout closes over current props, which are fixed
    // for this hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onCardConfirmed(): void {
    cardDeferred.current?.resolve();
    cardDeferred.current = null;
  }

  // Card-level failures (declines) keep the form mounted so the user can fix the
  // card and resubmit the same PaymentIntent — we only show the message.
  function onCardError(msg: string): void {
    setPromptError(msg);
  }

  function onCancel(): void {
    if (creatingOrder.current) return;
    cancelled.current = true;
    cardDeferred.current?.reject(new CancelledError());
    cardDeferred.current = null;
    // Deliberate cancel abandons this checkout: drop the persisted key so a later
    // same-cart attempt starts a fresh order instead of replaying the cancelled
    // one. (A 3DS reload unmounts without calling this, so the key survives there.)
    clearAttendeeCheckout(eventId);
    requestId.current = null;
    void cancelPendingAuthorization().catch(() => undefined);
  }

  function onRetry(): void {
    setError(null);
    setPromptError(null);
    setPhase('working');
    setMessage('Setting up your payment…');
    void runCheckout();
  }

  return {
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
  };
}
