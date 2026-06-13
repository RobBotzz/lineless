import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { AlertDialog } from '../../../components/feedback';
import {
  CartIcon,
  ChevronDownIcon,
  CommentIcon,
  DeleteIcon,
  MinusIcon,
  PlusIcon,
} from '../../../components/icons';
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
  product: CashierProduct;
  quantity: number;
  comments: string[]; // one entry per unit (index i = unit #(i+1))
  showComments: boolean;
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

  const visibleProducts =
    selectedStand === ALL_STANDS
      ? cashierProducts
      : cashierProducts.filter((product) => product.standId === selectedStand);

  const total = cart.reduce((sum, line) => sum + line.product.priceIncludingTax * line.quantity, 0);

  // One card per product; a unit (and its comment slot) is added on each add.
  function addToCart(product: CashierProduct) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1, comments: [...line.comments, ''] }
            : line,
        );
      }
      return [...current, { product, quantity: 1, comments: [''], showComments: false }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const quantity = line.quantity + delta;
          const comments =
            delta > 0 ? [...line.comments, ''] : line.comments.slice(0, Math.max(quantity, 0));
          return { ...line, quantity, comments };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  function toggleComments(productId: string) {
    setCart((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, showComments: !line.showComments } : line,
      ),
    );
  }

  function setComment(productId: string, index: number, value: string) {
    setCart((current) =>
      current.map((line) =>
        line.product.id === productId
          ? { ...line, comments: line.comments.map((c, i) => (i === index ? value : c)) }
          : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.product.id !== productId));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
    try {
      const items: OrderItem[] = cart.map((line) => {
        const comments = line.comments.map((comment) => comment.trim());
        return {
          productId: line.product.id,
          productName: line.product.name,
          standId: line.product.standId,
          standName: line.product.standName,
          unitPrice: line.product.priceIncludingTax,
          quantity: line.quantity,
          ...(comments.some(Boolean) ? { comments } : {}),
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
              <ul className="space-y-3">
                {cart.map((line) => (
                  <CartLineCard
                    key={line.product.id}
                    line={line}
                    onDecrease={() => changeQuantity(line.product.id, -1)}
                    onIncrease={() => changeQuantity(line.product.id, 1)}
                    onRemove={() => removeLine(line.product.id)}
                    onToggleComments={() => toggleComments(line.product.id)}
                    onCommentChange={(index, value) => setComment(line.product.id, index, value)}
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

function CartLineCard({
  line,
  onDecrease,
  onIncrease,
  onRemove,
  onToggleComments,
  onCommentChange,
}: {
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  onToggleComments: () => void;
  onCommentChange: (index: number, value: string) => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <img
          src={line.product.imageUrl}
          alt={line.product.name}
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-md bg-surface-muted object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text">{line.product.name}</p>
          <p className="text-xs text-text-muted">{line.product.standName}</p>
          <p className="text-sm font-semibold text-accent">
            EUR {formatMoney(line.product.priceIncludingTax)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${line.product.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
        >
          <DeleteIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <QtyButton label="Decrease quantity" onClick={onDecrease}>
            <MinusIcon className="h-4 w-4" />
          </QtyButton>
          <span className="w-6 text-center text-sm font-semibold text-text">{line.quantity}</span>
          <QtyButton label="Increase quantity" onClick={onIncrease}>
            <PlusIcon className="h-4 w-4" />
          </QtyButton>
        </div>
        <span className="text-sm font-semibold text-text">
          EUR {formatMoney(line.product.priceIncludingTax * line.quantity)}
        </span>
      </div>

      <button
        type="button"
        onClick={onToggleComments}
        aria-expanded={line.showComments}
        className="mt-3 flex w-full items-center gap-2 border-t border-border pt-3 text-xs font-semibold tracking-wide text-text-muted uppercase transition-colors hover:text-text"
      >
        <CommentIcon className="h-4 w-4" />
        <span>Item comments</span>
        <ChevronDownIcon
          className={`ml-auto h-4 w-4 transition-transform ${line.showComments ? 'rotate-180' : ''}`}
        />
      </button>

      {line.showComments ? (
        <div className="mt-3 space-y-3">
          {line.comments.map((comment, index) => (
            <div key={index}>
              <label
                htmlFor={`${line.product.id}-note-${index}`}
                className="text-xs text-text-muted"
              >
                {line.product.name} #{index + 1}
              </label>
              <input
                id={`${line.product.id}-note-${index}`}
                value={comment}
                onChange={(event) => onCommentChange(index, event.target.value)}
                placeholder="Add a note (optional)"
                className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              />
            </div>
          ))}
        </div>
      ) : null}
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
