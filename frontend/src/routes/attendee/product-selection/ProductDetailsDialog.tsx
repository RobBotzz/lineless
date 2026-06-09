import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatMoney, type Product } from '@/types/product';

import { ImageIcon } from '@/components/icons';
import { Rating } from './Rating';

interface ProductDetailsDialogProps {
  product: Product;
  standName: string;
  rating: number | null;
  onClose: () => void;
}

export function ProductDetailsDialog({
  product,
  standName,
  rating,
  onClose,
}: ProductDetailsDialogProps) {
  const [imageOk, setImageOk] = useState(true);
  const showImage = !!product.productImageUrl && imageOk;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // z-[1100] sits above the navbar (z-[1001]); click the backdrop to dismiss.
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-labelledby="product-details-title"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-44 w-full overflow-hidden rounded-lg border border-border bg-surface-muted">
          {showImage ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
              src={product.productImageUrl!}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="product-details-title" className="text-lg font-semibold text-text">
              {product.productName}
            </h2>
            {standName && <p className="mt-0.5 text-sm text-text-muted">{standName}</p>}
          </div>
          <Rating value={rating} className="shrink-0" />
        </div>

        {product.productDescription && (
          <p className="mt-2 text-sm text-text-muted">{product.productDescription}</p>
        )}

        <div className="mt-4 flex items-center border-t border-border pt-4">
          <span className="text-base font-semibold text-text">
            €{formatMoney(product.priceIncludingTax)}
          </span>
        </div>

        <Button className="mt-4 w-full" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </section>
    </div>
  );
}
