import { Link, useParams } from 'react-router';

import { BackButton } from '@/components/shared';
import { paths } from '@/paths';
import { formatMoney } from '@/types/product';

import { ATTENDEE_WIDTH } from '../column';
import { CartIcon } from '../icons';
import { CartLine } from './CartLine';
import { useCart } from './cart-context';

export default function Cart() {
  const { eventId } = useParams();
  const { items, totalCount, totalCents, setQuantity, setComment, removeItem } = useCart();

  const backTo = eventId ? paths.attendee.event(eventId) : paths.home;

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
              <CartLine
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
              <Link
                to={eventId ? paths.attendee.checkout(eventId) : '#'}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-[var(--color-button-text)] transition-colors hover:bg-accent/90"
              >
                Checkout
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--color-button-text)] px-1.5 text-xs font-bold text-accent">
                  {totalCount}
                </span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
