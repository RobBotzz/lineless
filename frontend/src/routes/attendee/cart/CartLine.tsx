import { useState } from 'react';

import { formatMoney } from '@/types/product';

import { ChatIcon, ChevronDownIcon, ImageIcon, MinusIcon, PlusIcon, TrashIcon } from '../icons';
import type { CartItem } from './cart-context';

interface CartLineProps {
  item: CartItem;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetComment: (productId: string, index: number, comment: string) => void;
  onRemove: (productId: string) => void;
}

export function CartLine({ item, onSetQuantity, onSetComment, onRemove }: CartLineProps) {
  const { product, quantity, comments } = item;

  const [imageOk, setImageOk] = useState(true);
  // Open by default when a note already exists (e.g. after a refresh).
  const [commentsOpen, setCommentsOpen] = useState(() => comments.some((c) => c.trim() !== ''));

  const showImage = !!product.productImageUrl && imageOk;
  const lineTotal = product.priceIncludingTax * quantity;
  // Respect stock when bumping quantity, mirroring the product card's sold-out guard.
  const atStockLimit = quantity >= product.productStock;
  const commentCount = comments.filter((c) => c.trim() !== '').length;

  // Progressive disclosure: show every field up to the last one that has text,
  // plus one trailing empty field to type the next note. Only trailing empty
  // fields collapse — gaps in the middle (e.g. #1 cleared while #2 has text)
  // stay visible.
  const lastFilled = comments.reduce((last, c, i) => (c.trim() !== '' ? i : last), -1);
  const visibleComments = Math.min(comments.length, lastFilled + 2);

  const stepperButton =
    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <div className="relative rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Remove whole product — red trash in the top-right corner. */}
      <button
        type="button"
        onClick={() => onRemove(product._id)}
        aria-label={`Remove ${product.productName} from cart`}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <TrashIcon />
      </button>

      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
          {showImage ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
              src={product.productImageUrl!}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon />
            </div>
          )}
        </div>

        {/* Name + unit price */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
          <h3 className="truncate text-sm font-semibold text-text">{product.productName}</h3>
          <span className="text-sm font-semibold text-accent">
            €{formatMoney(product.priceIncludingTax)}
          </span>
        </div>
      </div>

      {/* Quantity stepper + line total */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={stepperButton}
            onClick={() => onSetQuantity(product._id, quantity - 1)}
            aria-label={`Decrease ${product.productName} quantity`}
          >
            <MinusIcon />
          </button>
          <span className="min-w-6 text-center text-sm font-semibold text-text" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className={stepperButton}
            onClick={() => onSetQuantity(product._id, quantity + 1)}
            disabled={atStockLimit}
            aria-label={`Increase ${product.productName} quantity`}
          >
            <PlusIcon />
          </button>
        </div>
        <span className="text-sm font-semibold text-text">€{formatMoney(lineTotal)}</span>
      </div>

      {/* Per-unit comments — collapsible to keep the line compact. */}
      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          aria-expanded={commentsOpen}
          className="flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted transition-colors hover:text-text"
        >
          <ChatIcon className="h-4 w-4" />
          <span>Item comments</span>
          {commentCount > 0 && (
            <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-bold text-accent">
              {commentCount}
            </span>
          )}
          <ChevronDownIcon
            className={`ml-auto h-4 w-4 transition-transform ${commentsOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {commentsOpen && (
          <div className="mt-3 space-y-3">
            {comments.slice(0, visibleComments).map((comment, index) => (
              <label key={index} className="block">
                <span className="text-xs text-text-muted">
                  {product.productName} #{index + 1}
                </span>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => onSetComment(product._id, index, e.target.value)}
                  placeholder="Add a note (optional)"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
