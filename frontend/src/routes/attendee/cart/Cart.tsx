import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { createOrder } from '@/api/orders';
import { getAttendeeStands } from '@/api/stands';
import { paths } from '@/paths';
import type { OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { ATTENDEE_WIDTH } from '../column';
import { CartIcon } from '@/components/icons';
import { CartCard } from '@/features/cart/CartCard';
import { PaymentMethodToggle } from '@/features/cart/PaymentMethodToggle';
import { CardCheckoutDialog, type PaymentMethod } from '@/features/payment';
import type { Order } from '@/types/order';
import { useCart } from './cart-context';

export default function Cart() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { items, totalCount, totalCents, setQuantity, setComment, removeItem, clear } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  // Non-null while the card flow runs: the items the dialog is paying for.
  const [cardItems, setCardItems] = useState<OrderItemView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backTo = eventId ? paths.attendee.event(eventId) : paths.home;

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
    setIsCheckingOut(true);
    try {
      const orderItems = await buildOrderItems(eventId);
      if (paymentMethod === 'CARD') {
        // Hand off to the card dialog, which opens/uses the tab and places the
        // order; it reports back through onCardSuccess.
        setCardItems(orderItems);
        return;
      }
      const order = await createOrder(eventId, orderItems);
      clear();
      navigate(paths.attendee.checkoutPending(eventId, order._id), {
        state: { order, items: orderItems },
      });
    } catch (err) {
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
            className="text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

          {/* Sticky checkout bar — total + checkout, aligned to the column. */}
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-4">
            <div
              className={`pointer-events-auto mx-auto ${ATTENDEE_WIDTH} rounded-2xl border border-border bg-surface/95 p-3 shadow-[0_8px_24px_rgba(2,8,135,0.18)] backdrop-blur`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm text-text-muted">Total</span>
                <span className="text-base font-bold text-accent">€{formatMoney(totalCents)}</span>
              </div>
              <div className="mb-2">
                <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
              </div>
              <Button
                className="h-12 w-full gap-2 rounded-xl"
                disabled={isCheckingOut}
                onClick={handleCheckout}
              >
                {isCheckingOut ? (
                  'Processing Payment…'
                ) : (
                  <>
                    Checkout
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-button-text px-1.5 text-xs font-bold text-accent">
                      {totalCount}
                    </span>
                  </>
                )}
              </Button>
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
        />
      )}

      <AlertDialog
        message={error}
        title="Error"
        acknowledgeLabel="Close"
        onAcknowledge={() => setError(null)}
      />
    </div>
  );
}
