import { useMemo, useState } from 'react';
import { Link, useLoaderData, useParams, useRouteError } from 'react-router';

import { paths } from '@/paths';

import { useCart } from '../cart/cart-context';
import { ATTENDEE_WIDTH } from '../column';
import { CartIcon } from '../icons';
import { ProductCard } from './ProductCard';
import { ALL_STANDS, StandFilter } from './StandFilter';
import type { productSelectionLoader } from './data';

export default function ProductSelection() {
  const { event, stands, productsByStand } = useLoaderData<typeof productSelectionLoader>();
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

      {/* Sticky cart bar — always visible, aligned to the product-card column. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-4">
        <div className={`pointer-events-auto mx-auto ${ATTENDEE_WIDTH}`}>
          <Link
            to={eventId ? paths.attendee.cart(eventId) : '#'}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-[var(--color-button-text)] shadow-[0_8px_24px_rgba(2,8,135,0.25)] transition-colors hover:bg-accent/90"
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
