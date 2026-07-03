import { useMemo, useState } from 'react';
import { Link, useLoaderData, useParams, useRouteError, useRouteLoaderData } from 'react-router';

import { paths } from '@/paths';

import { useCart } from '../cart/cart-context';
import type { AttendeeLayoutLoaderData } from '../data';
import { CartIcon } from '@/components/icons';
import { PRIMARY_BTN_CLASS } from '@/components/shared';
import { ProductCard } from './ProductCard';
import { ALL_STANDS, StandFilter } from './StandFilter';
import type { productSelectionLoader } from './data';

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

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-16 z-40 pb-2 pt-1">
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
              ratingsEnabled={event.ratingsEnabled}
              onAdd={addItem}
              onSetQuantity={setQuantity}
            />
          ))
        )}
      </div>

      {/* Sticky to the viewport bottom; settles above the footer at page end */}
      <div className="sticky bottom-0 z-30 mt-auto pb-2 pt-3">
        <Link
          to={eventId ? paths.attendee.cart(eventId) : '#'}
          className={`${PRIMARY_BTN_CLASS} flex items-center justify-center gap-2 bg-accent px-4 font-semibold text-button-text shadow-[0_-6px_20px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] transition-colors hover:bg-accent/90`}
        >
          <CartIcon className="h-5 w-5" />
          <span>View Cart</span>
          {totalCount > 0 && (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-button-text px-1.5 text-xs font-bold text-accent">
              {totalCount}
            </span>
          )}
        </Link>
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
