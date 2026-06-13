import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { CartIcon, ImageIcon, InfoIcon, PlusIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { CartCard } from '@/features/cart/CartCard';
import { useCartState } from '@/features/cart/useCartState';
import { ProductDetailsDialog } from '@/features/catalog/ProductDetailsDialog';
import { useAddGuard } from '@/lib/useAddGuard';
import { createManualOrder } from '@/api/orders';
import type { OrderItem } from '@/types/order';
import { formatMoney, type Product } from '@/types/product';
import { paths } from '@/paths';

import { cashierProducts, cashierStands } from './cashierMockData';

const FALLBACK_EVENT_ID = 'demo-event';
const ALL_STANDS = 'all';

// Manual order view: the cashier picks products (filtered per stand), builds a
// cart, and checks out — creating the order, then returns to the cashier home.
// The cart is in-memory (no persistKey) so it starts fresh for each customer.
export default function CashierManualOrder() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();
  const navigate = useNavigate();

  const { items, totalCents, addItem, setQuantity, setComment, removeItem, clear } = useCartState();

  const [selectedStand, setSelectedStand] = useState<string>(ALL_STANDS);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product carries no stand name; resolve it by id like the attendee page does.
  const standsById = useMemo(
    () => Object.fromEntries(cashierStands.map((s) => [s._id, s.standName])),
    [],
  );

  const visibleProducts =
    selectedStand === ALL_STANDS
      ? cashierProducts
      : cashierProducts.filter((product) => product.standId === selectedStand);

  async function handleCheckout() {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    try {
      const orderItems: OrderItem[] = items.map((item) => {
        const comments = item.comments.map((comment) => comment.trim());
        return {
          productId: item.product._id,
          productName: item.product.productName,
          standId: item.product.standId,
          standName: standsById[item.product.standId] ?? '',
          unitPrice: item.product.priceIncludingTax,
          quantity: item.quantity,
          ...(comments.some(Boolean) ? { comments } : {}),
        };
      });
      await createManualOrder({ items: orderItems });
      clear(); // next customer starts with an empty cart
      navigate(paths.operator.cashier(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the order.');
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Back to Cashier Stand</BackButton>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <StandTab
              active={selectedStand === ALL_STANDS}
              onClick={() => setSelectedStand(ALL_STANDS)}
            >
              All
            </StandTab>
            {cashierStands.map((stand) => (
              <StandTab
                key={stand._id}
                active={selectedStand === stand._id}
                onClick={() => setSelectedStand(stand._id)}
              >
                {stand.standName}
              </StandTab>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductTile
                key={product._id}
                product={product}
                standName={standsById[product.standId] ?? ''}
                onAdd={() => addItem(product)}
              />
            ))}
          </div>
        </div>

        <aside className="flex w-full flex-col lg:w-80 lg:border-l lg:border-border lg:pl-6">
          <div className="flex items-center gap-2 border-b border-border pb-4 text-text">
            <CartIcon className="h-5 w-5" />
            <span className="font-semibold">Cart</span>
          </div>

          <div className="flex-1 py-4">
            {items.length === 0 ? (
              <EmptyCart />
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <CartCard
                    key={item.product._id}
                    item={item}
                    compact
                    standName={standsById[item.product.standId]}
                    onSetQuantity={setQuantity}
                    onSetComment={setComment}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Total:</span>
              <span className="text-base font-semibold text-accent">
                €{formatMoney(totalCents)}
              </span>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={items.length === 0 || isCheckingOut}
              onClick={handleCheckout}
            >
              {isCheckingOut ? 'Processing…' : 'Checkout'}
            </Button>
          </div>
        </aside>
      </div>

      <AlertDialog
        message={error}
        onAcknowledge={() => setError(null)}
        title="Checkout failed"
        acknowledgeLabel="Close"
      />
    </div>
  );
}

function StandTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors ${
        active
          ? 'bg-accent text-[var(--color-button-text)]'
          : 'bg-surface-muted text-text hover:bg-surface-muted/80'
      }`}
    >
      {children}
    </button>
  );
}

// The whole tile is the add button; a small "i" opens product details. The two
// buttons are siblings (not nested) so the markup stays valid and accessible.
function ProductTile({
  product,
  standName,
  onAdd,
}: {
  product: Product;
  standName: string;
  onAdd: () => void;
}) {
  const [imageOk, setImageOk] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showImage = !!product.productImageUrl && imageOk;

  // Guards a single tap firing twice (duplicate/ghost events on some browsers).
  const runGuarded = useAddGuard();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => runGuarded(onAdd)}
        className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-surface-muted">
          {showImage ? (
            <img
              src={product.productImageUrl!}
              alt={product.productName}
              loading="lazy"
              onError={() => setImageOk(false)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{product.productName}</p>
            <p className="text-sm font-semibold text-accent">
              €{formatMoney(product.priceIncludingTax)}
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-accent transition-colors group-hover:bg-accent-soft">
            <PlusIcon className="h-5 w-5" />
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={`Details for ${product.productName}`}
        className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <InfoIcon className="h-4 w-4" />
      </button>

      {detailsOpen && (
        <ProductDetailsDialog
          product={product}
          standName={standName}
          rating={product.rating}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-text-muted">
      <CartIcon className="h-10 w-10 opacity-40" />
      <span className="text-sm">Cart is empty</span>
    </div>
  );
}
