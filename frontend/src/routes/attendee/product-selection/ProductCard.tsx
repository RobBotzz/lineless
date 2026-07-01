import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatMoney, productImageSrc, type Product } from '@/types/product';

import { ImageIcon, InfoIcon, PlusIcon } from '@/components/icons';
import { QuantityStepper } from '@/components/shared/QuantityStepper';
import { useAddGuard } from '@/lib/useAddGuard';
import { ProductDetailsDialog } from '@/features/catalog/ProductDetailsDialog';
import { Rating } from '@/features/catalog/Rating';

interface ProductCardProps {
  product: Product;
  standName: string;
  cartQuantity: number;
  ratingsEnabled: boolean;
  onAdd: (product: Product) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
}

export function ProductCard({
  product,
  standName,
  cartQuantity,
  ratingsEnabled,
  onAdd,
  onSetQuantity,
}: ProductCardProps) {
  const [imageOk, setImageOk] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const imageSrc = productImageSrc(product);
  const showImage = !!imageSrc && imageOk;
  const soldOut = product.productStock <= 0;
  const atStockLimit = !soldOut && cartQuantity >= product.productStock;

  const rating = product.rating ?? null;
  // No inline preview — the full description lives in the details dialog, opened
  // via the "i" button, which is shown only when a description exists.
  const hasDescription = !!product.productDescription?.trim();

  // Guards a single tap firing twice (duplicate/ghost events on some browsers).
  const runGuarded = useAddGuard();
  function handleAdd() {
    if (atStockLimit) return;
    runGuarded(() => onAdd(product));
  }

  return (
    <div className="relative flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Details button — grey "i" in the top-right corner. Shown only when there
          is a description to reveal. */}
      {hasDescription && (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label={`Details for ${product.productName}`}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <InfoIcon />
        </button>
      )}

      {/* Thumbnail */}
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
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

      {/* Details — name + rating + optional description, then price/add row. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* pr-6 keeps the name clear of the info button. */}
        <h3 className="truncate pr-6 text-sm font-semibold text-text">{product.productName}</h3>
        {ratingsEnabled && <Rating value={rating} />}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-sm font-semibold text-text">
            €{formatMoney(product.priceIncludingTax)}
          </span>
          {cartQuantity > 0 ? (
            // Mirrors the cart's stepper. Minus stays enabled at 1: it drops the
            // quantity to 0, removing the line and reverting to the Add button.
            <QuantityStepper
              quantity={cartQuantity}
              onDecrease={() => onSetQuantity(product._id, cartQuantity - 1)}
              onIncrease={() => onSetQuantity(product._id, cartQuantity + 1)}
              disableIncrease={atStockLimit}
              decreaseLabel={`Decrease ${product.productName} quantity`}
              increaseLabel={`Increase ${product.productName} quantity`}
            />
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
          showRating={ratingsEnabled}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </div>
  );
}
