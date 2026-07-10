import { useRef, useState } from 'react';
import { Link, useLoaderData, useNavigate, useParams, useRouteLoaderData } from 'react-router';

import { AlertDialog, StockConflictDialog, type StockConflictItem } from '@/components/feedback';
import { BackButton, PrimaryButton } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import type { AttendeeLayoutLoaderData } from '../data';
import { createOrder, InsufficientStockError } from '@/api/orders';
import { setAttendeeSessionEmail } from '@/api/sessions';
import { getAttendeeStands } from '@/api/stands';
import { getAttendeeSession, rememberAttendeeEmail } from '@/auth/keychain';
import { paths } from '@/paths';
import type { OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { CartIcon } from '@/components/icons';
import { CartCard } from '@/features/cart/CartCard';
import { PaymentMethodToggle } from '@/features/cart/PaymentMethodToggle';
import { MAX_CART_ITEMS } from '@/features/cart/useCartState';
import { CardCheckoutDialog, type PaymentMethod } from '@/features/payment';
import type { Order } from '@/types/order';
import { useCart } from './cart-context';
import type { CartLoaderData } from './data';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Cart() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { cashierEnabled } = useLoaderData() as CartLoaderData;
  const { event } = useRouteLoaderData('attendee-event') as AttendeeLayoutLoaderData;
  const {
    items,
    totalCount,
    totalCents,
    atItemLimit,
    setQuantity,
    setComment,
    removeItem,
    applyStockShortages,
    clear,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  // Non-null while the card flow runs: the items the dialog is paying for.
  const [cardItems, setCardItems] = useState<OrderItemView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stockConflict, setStockConflict] = useState<StockConflictItem[] | null>(null);
  const checkoutAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);

  // Prefill from the email the attendee already gave on this session; if it's
  // known we don't ask again (just offer to change it).
  const [email, setEmail] = useState(() =>
    eventId ? (getAttendeeSession(eventId)?.email ?? '') : '',
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(() => email === '');

  const backTo = eventId ? paths.attendee.event(eventId) : paths.home;

  // Guard for session holders whose event stopped/completed while browsing. The
  // layout gate only covers visitors without a session; the checkout itself would
  // otherwise call createOrder and fail at the backend. Mirrors ProductSelection.
  if (event.status !== 'ACTIVE') {
    const message =
      event.status === 'COMPLETED'
        ? 'This event has ended.'
        : 'This event is not accepting new orders.';
    return (
      <div className="space-y-4">
        <BackButton to={backTo}>Back</BackButton>
        <div className="flex flex-col items-center gap-5 py-20 text-center">
          <p className="text-text-muted">{message}</p>
          <Link
            to={eventId ? paths.attendee.orders(eventId) : '#'}
            className={buttonVariants({ variant: 'outline' })}
          >
            View your orders
          </Link>
        </div>
      </div>
    );
  }

  function handleStockConflict(conflict: InsufficientStockError) {
    const affectedItems = conflict.shortages.map((shortage) => {
      const item = items.find((candidate) => candidate.product._id === shortage.productId);
      return {
        ...shortage,
        productName: item?.product.productName ?? 'Product',
      };
    });
    applyStockShortages(conflict.shortages);
    checkoutAttempt.current = null;
    setCardItems(null);
    setStockConflict(affectedItems);
    setIsCheckingOut(false);
  }

  // Joins each cart line with its stand name for display on the confirmation.
  async function buildOrderItems(currentEventId: string): Promise<OrderItemView[]> {
    const stands = await getAttendeeStands(currentEventId);
    const standNameById = new Map(stands.map((s) => [s._id, s.standName]));
    return items.map((item) => ({
      productId: item.product._id,
      productName: item.product.productName,
      standId: item.product.standId,
      standName: standNameById.get(item.product.standId) ?? '',
      unitPrice: item.product.priceIncludingTax,
      quantity: item.quantity,
      comments: item.comments.map((c) => c.trim()),
    }));
  }

  async function handleCheckout() {
    if (items.length === 0 || !eventId || isCheckingOut) return;

    setError(null);
    setEmailError(null);
    setIsCheckingOut(true);
    try {
      // Email is required for card payments (digital receipt) and optional for
      // cash. For cash, only validate/save it when the attendee actually typed one.
      const trimmedEmail = email.trim();
      if (paymentMethod === 'CARD' || trimmedEmail !== '') {
        if (!EMAIL_PATTERN.test(trimmedEmail)) {
          setEmailError('Please enter a valid email address.');
          setIsCheckingOut(false);
          return;
        }
        // Link the email to the session first; the order picks it up server-side.
        await setAttendeeSessionEmail(eventId, trimmedEmail);
        // Remember it locally so we don't ask again on the next checkout.
        rememberAttendeeEmail(eventId, trimmedEmail);
        // The email is accepted and saved: switch to the summary view so cancelling
        // the card dialog returns to "Receipt to X [Change]", not the raw input.
        setEditingEmail(false);
      }
      const orderItems = await buildOrderItems(eventId);
      if (paymentMethod === 'CARD') {
        // Hand off to the card dialog, which opens/uses the tab and places the
        // order; it reports back through onCardSuccess.
        setCardItems(orderItems);
        return;
      }
      const fingerprint = JSON.stringify(orderItems);
      if (checkoutAttempt.current?.fingerprint !== fingerprint) {
        checkoutAttempt.current = { fingerprint, requestId: crypto.randomUUID() };
      }
      const order = await createOrder(eventId, orderItems, checkoutAttempt.current.requestId);
      clear();
      navigate(paths.attendee.payOrder(eventId, order._id), {
        state: { order, items: orderItems },
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        handleStockConflict(err);
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not place the order.');
      setIsCheckingOut(false);
    }
  }

  function handleCardSuccess(order: Order) {
    const orderItems = cardItems ?? [];
    setCardItems(null);
    clear();
    if (!eventId) return;
    navigate(paths.attendee.checkoutConfirmed(eventId, order._id), {
      state: { order, items: orderItems },
    });
  }

  function handleCardClose() {
    setCardItems(null);
    setIsCheckingOut(false);
  }

  return (
    <div className="space-y-4">
      <BackButton to={backTo}>Back</BackButton>

      <h1 className="text-lg font-semibold text-text">Shopping Cart</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <CartIcon className="h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-muted">Your cart is empty.</p>
          <Link
            to={backTo}
            className="text-sm font-semibold text-accent-contrast hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <CartCard
                key={item.product._id}
                item={item}
                onSetQuantity={setQuantity}
                onSetComment={setComment}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Sticky checkout bar — pinned to the viewport bottom while scrolling,
              parking below the last item (above the footer) at the end. */}
          <div className="sticky bottom-0 z-30 pb-4 pt-3">
            <div className="rounded-2xl border border-border bg-surface/95 p-3 shadow-[0_-6px_20px_color-mix(in_srgb,var(--color-accent)_10%,transparent)] backdrop-blur">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm text-text-muted">Total</span>
                <span className="text-base font-bold text-accent-contrast">
                  €{formatMoney(totalCents)}
                </span>
              </div>
              {editingEmail ? (
                <div className="mb-2">
                  <label htmlFor="checkout-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder={paymentMethod === 'CARD' ? 'Email' : 'Email (optional)'}
                    aria-invalid={!!emailError}
                    disabled={isCheckingOut}
                    className={`h-11 w-full rounded-lg border bg-background px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      emailError ? 'border-danger' : 'border-border'
                    }`}
                  />
                  {emailError && <p className="mt-1 px-1 text-xs text-danger">{emailError}</p>}
                </div>
              ) : (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-text-muted">
                    Receipt to <span className="font-medium text-text">{email}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingEmail(true)}
                    disabled={isCheckingOut}
                    className="shrink-0 text-xs font-semibold text-accent-contrast hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Change
                  </button>
                </div>
              )}
              {/* With no cashier, Card is the only option — showing a
                  single-choice toggle would be pointless, so hide it. */}
              {cashierEnabled && (
                <div className="mb-2">
                  <PaymentMethodToggle
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    cashEnabled={cashierEnabled}
                  />
                </div>
              )}
              {atItemLimit && (
                <p className="mb-2 text-center text-xs text-text-muted">
                  You&apos;ve reached the maximum of {MAX_CART_ITEMS} items per order.
                </p>
              )}
              <PrimaryButton className="gap-2" disabled={isCheckingOut} onClick={handleCheckout}>
                {isCheckingOut ? (
                  'Processing Payment…'
                ) : (
                  <>
                    Create Order
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-button-text px-1.5 text-xs font-bold text-accent">
                      {totalCount}
                    </span>
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>
        </>
      )}

      {cardItems && eventId && (
        <CardCheckoutDialog
          eventId={eventId}
          items={cardItems}
          onSuccess={handleCardSuccess}
          onClose={handleCardClose}
          onStockConflict={handleStockConflict}
        />
      )}

      <AlertDialog
        message={error}
        title="Error"
        acknowledgeLabel="Close"
        onAcknowledge={() => setError(null)}
      />
      <StockConflictDialog items={stockConflict} onAcknowledge={() => setStockConflict(null)} />
    </div>
  );
}
