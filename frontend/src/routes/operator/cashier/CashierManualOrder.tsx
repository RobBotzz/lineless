import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { AlertDialog } from '../../../components/feedback';
import { CartIcon, DeleteIcon, MinusIcon, PlusIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { Button } from '../../../components/ui/button';
import { createManualOrder } from '../../../api/orders';
import type { OrderItem } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { cashierProducts, cashierStands, type CashierProduct } from './cashierMockData';

const FALLBACK_EVENT_ID = 'demo-event';
const ALL_STANDS = 'all';

interface CartLine {
  lineId: string;
  product: CashierProduct;
  quantity: number;
  comment: string;
}

// Manual order view: the cashier picks products (filtered per stand), builds a
// cart, and checks out — creating an order and going straight to its payment.
export default function CashierManualOrder() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();
  const navigate = useNavigate();

  const [selectedStand, setSelectedStand] = useState<string>(ALL_STANDS);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineIdRef = useRef(0);

  const visibleProducts =
    selectedStand === ALL_STANDS
      ? cashierProducts
      : cashierProducts.filter((product) => product.standId === selectedStand);

  const total = cart.reduce((sum, line) => sum + line.product.priceIncludingTax * line.quantity, 0);

  // Each add is its own line so the same product can carry separate comments.
  function addToCart(product: CashierProduct) {
    lineIdRef.current += 1;
    const lineId = `line-${lineIdRef.current}`;
    setCart((current) => [...current, { lineId, product, quantity: 1, comment: '' }]);
  }

  function changeQuantity(lineId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.lineId === lineId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function setLineComment(lineId: string, comment: string) {
    setCart((current) =>
      current.map((line) => (line.lineId === lineId ? { ...line, comment } : line)),
    );
  }

  function removeLine(lineId: string) {
    setCart((current) => current.filter((line) => line.lineId !== lineId));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const items: OrderItem[] = cart.map((line) => {
        const comment = line.comment.trim();
        return {
          id: line.lineId,
          productId: line.product.id,
          productName: line.product.name,
          standId: line.product.standId,
          standName: line.product.standName,
          unitPrice: line.product.priceIncludingTax,
          quantity: line.quantity,
          ...(comment ? { comment } : {}),
        };
      });
      const order = await createManualOrder({ items });
      // Skip the order-selection step: go straight to the new order's payment.
      navigate(paths.operator.cashierPaymentOrder(eventId, order.orderId));
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
                key={stand.id}
                active={selectedStand === stand.id}
                onClick={() => setSelectedStand(stand.id)}
              >
                {stand.name}
              </StandTab>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />
            ))}
          </div>
        </div>

        <aside className="flex w-full flex-col lg:w-80 lg:border-l lg:border-border lg:pl-6">
          <div className="flex items-center gap-2 border-b border-border pb-4 text-text">
            <CartIcon className="h-5 w-5" />
            <span className="font-semibold">Cart</span>
          </div>

          <div className="flex-1 py-4">
            {cart.length === 0 ? (
              <EmptyCart />
            ) : (
              <ul className="divide-y divide-border">
                {cart.map((line) => (
                  <CartLineRow
                    key={line.lineId}
                    line={line}
                    onDecrease={() => changeQuantity(line.lineId, -1)}
                    onIncrease={() => changeQuantity(line.lineId, 1)}
                    onRemove={() => removeLine(line.lineId)}
                    onCommentChange={(value) => setLineComment(line.lineId, value)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Total:</span>
              <span className="text-base font-semibold text-accent">EUR {formatMoney(total)}</span>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={cart.length === 0 || isCheckingOut}
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

// The whole card is the add button; the "+" is an affordance inside it.
function ProductCard({ product, onAdd }: { product: CashierProduct; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-surface-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{product.name}</p>
          <p className="text-sm font-semibold text-accent">
            EUR {formatMoney(product.priceIncludingTax)}
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-accent transition-colors group-hover:bg-accent-soft">
          <PlusIcon className="h-5 w-5" />
        </span>
      </div>
    </button>
  );
}

function CartLineRow({
  line,
  onDecrease,
  onIncrease,
  onRemove,
  onCommentChange,
}: {
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  onCommentChange: (value: string) => void;
}) {
  return (
    <li className="py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{line.product.name}</p>
          <p className="text-xs text-text-muted">
            EUR {formatMoney(line.product.priceIncludingTax * line.quantity)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <QtyButton label="Decrease quantity" onClick={onDecrease}>
            <MinusIcon className="h-4 w-4" />
          </QtyButton>
          <span className="w-6 text-center text-sm font-semibold text-text">{line.quantity}</span>
          <QtyButton label="Increase quantity" onClick={onIncrease}>
            <PlusIcon className="h-4 w-4" />
          </QtyButton>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${line.product.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-danger"
        >
          <DeleteIcon className="h-4 w-4" />
        </button>
      </div>
      <input
        value={line.comment}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Add a note (optional)"
        aria-label={`Note for ${line.product.name}`}
        className="mt-2 h-9 w-full rounded-md border border-border bg-surface px-3 text-xs text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
      />
    </li>
  );
}

function QtyButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-text transition-colors hover:bg-surface-muted"
    >
      {children}
    </button>
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
