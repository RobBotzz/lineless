import { useEffect, useRef, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';

import { Button } from '@/components/ui/button';
import { createCardOrder, getAttendeeOrder } from '@/api/orders';
import { createTab, getTabStatus } from '@/api/tabs';
import { clearAttendeeTab, getAttendeeTab, setAttendeeTab } from '@/auth/keychain';
import type { Order, OrderItemView } from '@/types/order';

import { CardPaymentForm } from './CardPaymentForm';
import { stripePromise } from './stripe';

interface CardCheckoutDialogProps {
  eventId: string;
  items: OrderItemView[];
  onSuccess: (order: Order) => void;
  onClose: () => void;
}

interface CardPrompt {
  clientSecret: string;
  label: string;
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
}: CardCheckoutDialogProps) {
  const [phase, setPhase] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState('Setting up your payment…');
  const [prompt, setPrompt] = useState<CardPrompt | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bridges the imperative card form into the linear async runner: the runner
  // sets a prompt and awaits this deferred; the form resolves it on success.
  const cardDeferred = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);
  const started = useRef(false);

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
    setPrompt({ clientSecret, label });
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

  // Returns the id of an OPEN tab, opening + authorizing a new one if the stored
  // tab is missing or no longer usable.
  async function ensureOpenTab(): Promise<string> {
    const existing = getAttendeeTab(eventId);
    if (existing) {
      const tab = await getTabStatus(existing.tabId, eventId);
      if (tab.status === 'OPEN') return existing.tabId;
      clearAttendeeTab(eventId); // PAID / FAILED / mid-auth — open a fresh tab
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

      const result = await createCardOrder(eventId, items, tabId);
      if (result.status === 'created') {
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
      onSuccess(order);
    } catch (err) {
      if (err instanceof CancelledError) return;
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
    cardDeferred.current?.reject(new CancelledError());
    cardDeferred.current = null;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
    >
      <section
        aria-modal="true"
        role="dialog"
        aria-label="Card payment"
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Card payment</h2>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel payment"
            className="text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ✕
          </button>
        </div>

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
              Your card is only held, not charged, until you pick up your order.
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
      </section>
    </div>
  );
}
