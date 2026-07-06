import { useState } from 'react';

import { formatMoney, productImageSrc, tracksStock } from '@/types/product';
import { QuantityStepper } from '@/components/shared/QuantityStepper';
import { ChatIcon, ChevronDownIcon, DeleteIcon, ImageIcon } from '@/components/icons';

import type { CartItem } from './useCartState';

interface CartCardProps {
  item: CartItem;
  onSetQuantity: (productId: string, quantity: number) => void;
  // Omit to hide the per-unit comment section (e.g. cashier cart).
  onSetComment?: (productId: string, index: number, comment: string) => void;
  onRemove: (productId: string) => void;
  // Tighter thumbnail for narrow layouts (e.g. the cashier cart aside).
  compact?: boolean;
  // Optional stand label under the name; the attendee omits it.
  standName?: string;
}

export function CartCard({
  item,
  onSetQuantity,
  onSetComment,
  onRemove,
  compact = false,
  standName,
}: CartCardProps) {
  const { product, quantity, comments } = item;

  const [imageOk, setImageOk] = useState(true);
  // Open by default when a note already exists (e.g. after a refresh).
  const [commentsOpen, setCommentsOpen] = useState(() => comments.some((c) => c.trim() !== ''));

  const imageSrc = productImageSrc(product);
  const showImage = !!imageSrc && imageOk;
  const lineTotal = product.priceIncludingTax * quantity;
  // Respect stock when bumping quantity, mirroring the product card's sold-out guard.
  const atStockLimit = tracksStock(product) && quantity >= product.productStock;
  const commentCount = comments.filter((c) => c.trim() !== '').length;

  // Progressive disclosure: show every field up to the last one that has text,
  // plus one trailing empty field to type the next note. Only trailing empty
  // fields collapse — gaps in the middle (e.g. #1 cleared while #2 has text)
  // stay visible.
  const lastFilled = comments.reduce((last, c, i) => (c.trim() !== '' ? i : last), -1);
  const visibleComments = Math.min(comments.length, lastFilled + 2);

  const thumbSize = compact ? 'h-14 w-14' : 'h-20 w-20';

  return (
    <div className="relative rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Remove whole product — red trash in the top-right corner. */}
      <button
        type="button"
        onClick={() => onRemove(product._id)}
        aria-label={`Remove ${product.productName} from cart`}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <DeleteIcon />
      </button>

      <div className="flex gap-4">
        {/* Thumbnail */}
        <div
          className={`${thumbSize} shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted`}
        >
          {showImage ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
              src={imageSrc!}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon />
            </div>
          )}
        </div>

        {/* Name + optional stand + unit price */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-6">
          <h3 className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
            {product.productName}
          </h3>
          {standName && (
            <span className="text-xs text-text-muted [overflow-wrap:anywhere]">{standName}</span>
          )}
          <span className="text-sm font-semibold text-accent-contrast">
            €{formatMoney(product.priceIncludingTax)}
          </span>
        </div>
      </div>

      {/* Quantity stepper + line total */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <QuantityStepper
          quantity={quantity}
          onDecrease={() => onSetQuantity(product._id, quantity - 1)}
          onIncrease={() => onSetQuantity(product._id, quantity + 1)}
          disableDecrease={quantity <= 1}
          disableIncrease={atStockLimit}
          decreaseLabel={`Decrease ${product.productName} quantity`}
          increaseLabel={`Increase ${product.productName} quantity`}
        />
        <span className="text-sm font-semibold text-text">€{formatMoney(lineTotal)}</span>
      </div>

      {/* Per-unit comments — only shown when the caller supplies onSetComment. */}
      {onSetComment && (
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
              <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-bold text-accent-contrast">
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
                  <span className="text-xs text-text-muted [overflow-wrap:anywhere]">
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
      )}
    </div>
  );
}
