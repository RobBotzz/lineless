import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatMoney, type Product } from '@/types/product';

import { ImageIcon, InfoIcon, MinusIcon, PlusIcon } from '../icons';
import { ProductDetailsDialog } from './ProductDetailsDialog';
import { Rating } from './Rating';

// TODO: dev-only placeholder until the backend exposes an aggregate product
// rating. Once `product.rating` is populated from the API, drop this helper and
// read `product.rating ?? null` directly. For now it deterministically leaves
// ~half of the products unrated so the "no rating yet" state stays visible.
function resolveRating(product: Product): number | null {
  if (typeof product.rating === 'number') return product.rating;
  const seed = product._id.charCodeAt(product._id.length - 1);
  if (seed % 2 === 0) return null;
  return Math.round((3.6 + (seed % 14) / 10) * 10) / 10;
}

interface ProductCardProps {
  product: Product;
  standName: string;
  cartQuantity: number;
  onAdd: (product: Product) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
}

// Shared with CartLine's stepper styling.
const stepperButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ProductCard({
  product,
  standName,
  cartQuantity,
  onAdd,
  onSetQuantity,
}: ProductCardProps) {
  const [imageOk, setImageOk] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showImage = !!product.productImageUrl && imageOk;
  const soldOut = product.productStock <= 0;
  const atStockLimit = !soldOut && cartQuantity >= product.productStock;

  // TODO: currently null when the product has no rating yet (see resolveRating).
  const rating = resolveRating(product);

  // Guard against a single tap firing the click handler twice (duplicate/ghost
  // events on some browsers). The lock releases on the next frame, so genuine
  // repeated taps still each add one.
  const lockedRef = useRef(false);
  function handleAdd() {
    if (lockedRef.current || atStockLimit) return;
    lockedRef.current = true;
    requestAnimationFrame(() => {
      lockedRef.current = false;
    });
    onAdd(product);
  }

  return (
    <div className="relative flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Details button — grey "i" in the top-right corner. */}
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={`Details for ${product.productName}`}
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <InfoIcon />
      </button>

      {/* Thumbnail */}
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
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

      {/* Details — name + rating + optional description, then price/add row. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* pr-6 keeps the name clear of the info button. */}
        <h3 className="truncate pr-6 text-sm font-semibold text-text">{product.productName}</h3>
        <Rating value={rating} />
        {product.productDescription && (
          <p className="line-clamp-2 text-xs text-text-muted">{product.productDescription}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-sm font-semibold text-text">
            €{formatMoney(product.priceIncludingTax)}
          </span>
          {cartQuantity > 0 ? (
            // Mirrors the cart's stepper. Minus stays enabled at 1: it drops the
            // quantity to 0, removing the line and reverting to the Add button.
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={stepperButton}
                onClick={() => onSetQuantity(product._id, cartQuantity - 1)}
                aria-label={`Decrease ${product.productName} quantity`}
              >
                <MinusIcon />
              </button>
              <span
                className="min-w-6 text-center text-sm font-semibold text-text"
                aria-live="polite"
              >
                {cartQuantity}
              </span>
              <button
                type="button"
                className={stepperButton}
                onClick={() => onSetQuantity(product._id, cartQuantity + 1)}
                disabled={atStockLimit}
                aria-label={`Increase ${product.productName} quantity`}
              >
                <PlusIcon />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              className="touch-manipulation"
              disabled={soldOut}
              onClick={handleAdd}
              aria-label={`Add ${product.productName} to cart`}
            >
              {soldOut ? (
                'Sold out'
              ) : (
                <span className="inline-flex items-center gap-1">
                  <PlusIcon />
                  Add
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {detailsOpen && (
        <ProductDetailsDialog
          product={product}
          standName={standName}
          rating={rating}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}
