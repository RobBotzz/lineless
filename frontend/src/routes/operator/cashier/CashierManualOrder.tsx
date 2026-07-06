import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';

import { AlertDialog, StockConflictDialog, type StockConflictItem } from '@/components/feedback';
import { CartIcon, ImageIcon, InfoIcon, PlusIcon, WarningTriangleIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { CartCard } from '@/features/cart/CartCard';
import { useCartState } from '@/features/cart/useCartState';
import { ProductDetailsDialog } from '@/features/catalog/ProductDetailsDialog';
import { useAddGuard } from '@/lib/useAddGuard';
import { ApiError } from '@/api/client';
import { getEventPublicInfo } from '@/api/events';
import { createManualOrder, InsufficientStockError, orderRequestConflict } from '@/api/orders';
import { getOperatorStands } from '@/api/stands';
import { getOperatorEventProducts } from '@/api/products';
import type { OrderItemView } from '@/types/order';
import { formatMoney, productImageSrc, tracksStock, type Product } from '@/types/product';
import { paths } from '@/paths';
import type { CashierContext } from './CashierLayout';

// The backend reports every non-ACTIVE event with the same code-less 409, so we
// read the public event status to word the block correctly: STOPPED/COMPLETED
// are terminal (no more orders), while a DRAFT event can still be started.
async function classifyInactiveEvent(eventId: string): Promise<'not-started' | 'ended'> {
  try {
    const info = await getEventPublicInfo(eventId);
    if (info.status === 'STOPPED' || info.status === 'COMPLETED') return 'ended';
  } catch {
    // Fall back to the retryable message if the status lookup fails.
  }
  return 'not-started';
}

// Cart is in-memory (no persistKey) so it starts fresh for each customer.
export default function CashierManualOrder() {
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const {
    items,
    totalCents,
    addItem,
    setQuantity,
    removeItem,
    applyStockShortages,
    syncProducts,
    clear,
  } = useCartState();

  const [products, setProducts] = useState<Product[]>([]);
  const [standNameById, setStandNameById] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Event-not-active hint: a code-less 409 means the event is not ACTIVE. The
  // wording depends on which non-active state it is — a DRAFT event can still be
  // started ("try again"), but STOPPED/COMPLETED are terminal (no new orders).
  // It clears on the next checkout attempt, so a DRAFT→ACTIVE start needs no
  // page reload.
  const [eventBlock, setEventBlock] = useState<'not-started' | 'ended' | null>(null);
  const [stockConflict, setStockConflict] = useState<StockConflictItem[] | null>(null);
  const checkoutAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);

  // The cashier sells the whole event menu, so the catalog spans every stand.
  useEffect(() => {
    Promise.all([getOperatorEventProducts(eventId, standId), getOperatorStands(eventId)])
      .then(([p, stands]) => {
        setProducts(p);
        setStandNameById(new Map(stands.map((s) => [s._id, s.standName])));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load products.'))
      .finally(() => setIsLoading(false));
  }, [eventId, standId]);

  const standNameFor = (product: Product) => standNameById.get(product.standId) ?? '';

  async function handleCheckout() {
    if (items.length === 0) return;
    setIsCheckingOut(true);
    setEventBlock(null); // revalidate on every attempt, don't stay blocked
    try {
      const orderItems: OrderItemView[] = items.map((item) => ({
        productId: item.product._id,
        productName: item.product.productName,
        standId: item.product.standId,
        standName: standNameFor(item.product),
        unitPrice: item.product.priceIncludingTax,
        quantity: item.quantity,
        comments: [],
      }));
      const fingerprint = JSON.stringify(orderItems);
      if (checkoutAttempt.current?.fingerprint !== fingerprint) {
        checkoutAttempt.current = { fingerprint, requestId: crypto.randomUUID() };
      }
      const order = await createManualOrder(
        { eventId, items: orderItems },
        standId,
        checkoutAttempt.current.requestId,
      );
      clear(); // next customer starts with an empty cart
      // Skip the order-selection step: go straight to the new order's payment.
      navigate(paths.operator.cashierPaymentOrder(eventId, order._id));
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        const affectedItems = err.shortages.map((shortage) => {
          const item = items.find((candidate) => candidate.product._id === shortage.productId);
          return {
            ...shortage,
            productName: item?.product.productName ?? 'Product',
          };
        });
        applyStockShortages(err.shortages);
        try {
          const refreshedProducts = await getOperatorEventProducts(eventId, standId);
          setProducts(refreshedProducts);
          syncProducts(refreshedProducts);
        } catch {
          // Keep the shortage response as a fallback if the catalog refresh is
          // unavailable. A later checkout conflict will retry the refresh.
          const availableById = new Map(
            err.shortages.map((shortage) => [shortage.productId, shortage.available]),
          );
          setProducts((current) =>
            current.map((product) => {
              const available = availableById.get(product._id);
              return available === undefined ? product : { ...product, productStock: available };
            }),
          );
        }
        checkoutAttempt.current = null;
        setStockConflict(affectedItems);
        setIsCheckingOut(false);
        return;
      }
      // The idempotency key was reused for an order that was cancelled/deleted.
      // Drop it so a fresh attempt starts a new request, and tell the operator.
      if (orderRequestConflict(err)) {
        checkoutAttempt.current = null;
        setError('This order was cancelled. Please start a new order.');
        setIsCheckingOut(false);
        return;
      }
      // A code-less 409 means the event isn't active. Read its actual status to
      // tell a not-yet-started event (retryable) from a terminal one (ended).
      if (err instanceof ApiError && err.status === 409) {
        setEventBlock(await classifyInactiveEvent(eventId));
        setIsCheckingOut(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not create the order.');
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-4 py-6 sm:px-6 lg:h-screen lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)} className="self-start">
        Cashier Stand
      </BackButton>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-text-muted">Loading products…</p>
      ) : (
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
          <div className="flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {products.length === 0 ? (
                <p className="col-span-full py-12 text-center text-sm text-text-muted">
                  No products available.
                </p>
              ) : (
                products.map((product) => (
                  <ProductTile
                    key={product._id}
                    product={product}
                    standName={standNameFor(product)}
                    cartQuantity={
                      items.find((item) => item.product._id === product._id)?.quantity ?? 0
                    }
                    onAdd={() => addItem(product)}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="flex w-full flex-col lg:h-full lg:w-80 lg:border-l lg:border-border lg:pl-6">
            <div className="flex items-center gap-2 border-b border-border pb-4 text-text">
              <CartIcon className="h-5 w-5" />
              <span className="font-semibold">Cart</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-4 lg:-mr-4 lg:pr-4">
              {items.length === 0 ? (
                <EmptyCart />
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <CartCard
                      key={item.product._id}
                      item={item}
                      compact
                      standName={standNameFor(item.product)}
                      onSetQuantity={setQuantity}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              {eventBlock && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-text">
                  <WarningTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  {eventBlock === 'ended' ? (
                    <span>
                      <span className="font-semibold">Event has ended.</span> No new orders can be
                      placed for this event.
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold">Event not active.</span> The organizer must
                      start the event before orders can be placed — then try again.
                    </span>
                  )}
                </div>
              )}
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
      )}

      <AlertDialog
        message={error}
        onAcknowledge={() => setError(null)}
        title="Error"
        acknowledgeLabel="Close"
      />
      <StockConflictDialog items={stockConflict} onAcknowledge={() => setStockConflict(null)} />
    </div>
  );
}

// The whole tile is the add button; a small "i" opens product details. The two
// buttons are siblings (not nested) so the markup stays valid and accessible.
function ProductTile({
  product,
  standName,
  cartQuantity,
  onAdd,
}: {
  product: Product;
  standName: string;
  cartQuantity: number;
  onAdd: () => void;
}) {
  const [imageOk, setImageOk] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const imageSrc = productImageSrc(product);
  const showImage = !!imageSrc && imageOk;
  const stockTracked = tracksStock(product);
  const soldOut = stockTracked && product.productStock <= 0;
  const atStockLimit = stockTracked && (soldOut || cartQuantity >= product.productStock);

  // Guards a single tap firing twice (duplicate/ghost events on some browsers).
  const runGuarded = useAddGuard();

  return (
    <div className="relative">
      <button
        type="button"
        disabled={atStockLimit}
        onClick={() => runGuarded(onAdd)}
        className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:border-accent/40 enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-surface-muted">
          {showImage ? (
            <img
              src={imageSrc!}
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
        <div className="flex items-center justify-between gap-2 p-2.5">
          <div className="min-w-0">
            <p
              className="line-clamp-2 min-h-10 text-sm font-medium text-text [overflow-wrap:anywhere]"
              title={product.productName}
            >
              {product.productName}
            </p>
            <p className="text-sm font-semibold text-accent">
              {soldOut ? 'Sold out' : `€${formatMoney(product.priceIncludingTax)}`}
            </p>
          </div>
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text transition-colors group-hover:bg-surface-muted">
            {atStockLimit ? (
              <span className="text-xs font-bold tabular-nums">{cartQuantity}</span>
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={`Details for ${product.productName}`}
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>

      {detailsOpen && (
        <ProductDetailsDialog
          product={product}
          standName={standName}
          rating={product.rating ?? null}
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
