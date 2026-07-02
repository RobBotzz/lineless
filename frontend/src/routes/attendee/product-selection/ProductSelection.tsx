import { useMemo, useState } from 'react';
import { Link, useLoaderData, useParams, useRouteError, useRouteLoaderData } from 'react-router';

import { paths } from '@/paths';

import { useCart } from '../cart/cart-context';
import type { AttendeeLayoutLoaderData } from '../data';
import { CartIcon } from '@/components/icons';
import { ProductCard } from './ProductCard';
import { ALL_STANDS, StandFilter } from './StandFilter';
import type { productSelectionLoader } from './data';
import { buttonVariants } from '@/components/ui/button';

export default function ProductSelection() {
  const { stands, productsByStand } = useLoaderData<typeof productSelectionLoader>();
  const { event } = useRouteLoaderData('attendee-event') as AttendeeLayoutLoaderData;
  const { eventId } = useParams();
  const { addItem, setQuantity, totalCount, items } = useCart();

  const [selectedStand, setSelectedStand] = useState<string>(ALL_STANDS);

  // Stand names are not shown on the card, but the details dialog uses them.
  const standsById = useMemo(
    () => Object.fromEntries(stands.map((s) => [s._id, s.standName])),
    [stands],
  );

  // Quantity already in the cart per product, to enforce the stock cap on add.
  const cartQuantityById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.product._id, i.quantity])),
    [items],
  );

  // Flatten across stands for "All", otherwise show the picked stand only.
  const visibleProducts = useMemo(() => {
    if (selectedStand === ALL_STANDS) return Object.values(productsByStand).flat();
    return productsByStand[selectedStand] ?? [];
  }, [selectedStand, productsByStand]);

  // Second-layer guard for session holders whose event stopped while they were browsing.
  // The layout gate handles the no-session case; this handles the in-session stopped/completed case.
  if (event.status !== 'ACTIVE') {
    const message =
      event.status === 'COMPLETED'
        ? 'This event has ended.'
        : 'This event is not accepting new orders.';
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <p className="text-text-muted">{message}</p>
        <Link
          to={eventId ? paths.attendee.orders(eventId) : '#'}
          className={buttonVariants({ variant: 'outline' })}
        >
          View your orders
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/95 pb-2 pt-1 backdrop-blur">
        <h1 className="sr-only">Products — {event.name}</h1>
        <StandFilter stands={stands} selected={selectedStand} onSelect={setSelectedStand} />
      </div>

      <div className="mt-3 space-y-3">
        {visibleProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">
            No products available{selectedStand === ALL_STANDS ? ' yet' : ' at this stand'}.
          </p>
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              standName={standsById[product.standId] ?? ''}
              cartQuantity={cartQuantityById[product._id] ?? 0}
              onAdd={addItem}
              onSetQuantity={setQuantity}
            />
          ))
        )}
      </div>

      {/* Sticky cart bar — pinned to the viewport bottom while scrolling, but it
          parks below the last product (above the footer) once you reach the end. */}
      <div className="pointer-events-none sticky bottom-0 z-20 pb-4 pt-3">
        <div className="pointer-events-auto">
          <Link
            to={eventId ? paths.attendee.cart(eventId) : '#'}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-[var(--color-button-text)] shadow-[0_8px_24px_color-mix(in_srgb,var(--color-accent)_25%,transparent)] transition-colors hover:bg-accent/90"
          >
            <CartIcon className="h-5 w-5" />
            <span>View Cart</span>
            {totalCount > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--color-button-text)] px-1.5 text-xs font-bold text-accent">
                {totalCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProductSelectionError() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : 'This menu could not be loaded right now.';
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-semibold text-text">Menu unavailable</h1>
      <p className="mt-2 text-sm text-text-muted">{message}</p>
    </div>
  );
}
