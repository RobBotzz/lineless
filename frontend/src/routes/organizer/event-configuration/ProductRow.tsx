import { useEffect, useState } from 'react';
import { EditIcon, ImageIcon } from '@/components/icons';
import { DeleteIconButton } from '@/components/shared';
import { formatMoney, priceExclTax, productImageSrc, type Product } from '@/types/product';

interface ProductRowProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  // Read-only mode (e.g. a completed, immutable event): hides edit/delete actions.
  disabled?: boolean;
}

export function ProductRow({ product, onEdit, onDelete, disabled = false }: ProductRowProps) {
  // Fall back to the placeholder when there is no URL or the image fails to load.
  const [imageOk, setImageOk] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageSrc = productImageSrc(product);
  const showImage = !!imageSrc && imageOk;

  const exclTax = priceExclTax(product);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
      {/* Thumbnail — clickable to enlarge when a valid image is present */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
        {showImage ? (
          <button
            aria-label={`Enlarge image of ${product.productName}`}
            className="h-full w-full cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
            type="button"
          >
            <img
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
              src={imageSrc!}
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      {showImage && lightboxOpen && (
        <ImageLightbox
          alt={product.productName}
          src={imageSrc!}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* The name takes the available space. Prices and actions are fixed-size
          flex items and move onto another line when the card becomes narrow. */}
      <div className="min-w-0 flex-[1_1_10rem]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm font-medium text-text [overflow-wrap:anywhere]">
            {product.productName}
          </span>
          <ProductTypeBadge instant={product.instantProduct} />
        </div>
        {product.productDescription && (
          <p className="truncate text-xs text-text-muted">{product.productDescription}</p>
        )}
      </div>

      {/* Price + actions stay together as one block, so on a narrow card they
          wrap onto a second line as a unit (right-aligned) rather than each
          breaking separately into a ragged layout. */}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Prices — incl. tax emphasized, excl. tax muted underneath */}
        <div className="text-right">
          <p className="text-base font-semibold text-text">
            €{formatMoney(product.priceIncludingTax)}
          </p>
          <p className="text-xs text-text-muted">€{formatMoney(exclTax)} excl. tax</p>
        </div>

        {/* Actions — hidden on a read-only (completed) event. */}
        {!disabled && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={`Edit ${product.productName}`}
              className="rounded-md p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              onClick={onEdit}
              type="button"
            >
              <EditIcon />
            </button>
            <DeleteIconButton label={`Delete ${product.productName}`} onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProductTypeBadge({ instant }: { instant: boolean }) {
  return (
    <span
      className={[
        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide leading-none',
        instant ? 'bg-success/10 text-success' : 'bg-accent-soft text-accent',
      ].join(' ')}
    >
      {instant ? 'Instant' : 'Manufactured'}
    </span>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    // z-[1100] sits above the navbar (z-[1001]); click anywhere to dismiss.
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
      role="presentation"
    >
      <img
        alt={alt}
        className="max-h-full max-w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        src={src}
      />
    </div>
  );
}
