import { useEffect, useState } from 'react';
import { formatMoney, priceInclTax, type Product } from '@/types/product';

interface ProductRowProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductRow({ product, onEdit, onDelete }: ProductRowProps) {
  // Fall back to the placeholder when there is no URL or the image fails to load.
  const [imageOk, setImageOk] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const showImage = !!product.productImageUrl && imageOk;

  const inclTax = priceInclTax(product);

  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
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
              src={product.productImageUrl!}
            />
          </button>
        ) : (
          <PlaceholderImageIcon />
        )}
      </div>

      {showImage && lightboxOpen && (
        <ImageLightbox
          alt={product.productName}
          src={product.productImageUrl!}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Name + type tag + description snippet. Capped width + mr-auto leaves
          some whitespace before the price column. The name never truncates —
          it wraps (and the tag wraps with it) when space runs short. */}
      <div className="mr-auto min-w-0 max-w-[62%]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium break-words text-text">{product.productName}</span>
          <ProductTypeBadge instant={product.instantProduct} />
        </div>
        {product.productDescription && (
          <p className="truncate text-xs text-text-muted">{product.productDescription}</p>
        )}
      </div>

      {/* Prices — incl. tax emphasized, excl. tax muted underneath */}
      <div className="shrink-0 text-right">
        <p className="text-base font-semibold text-text">€{formatMoney(inclTax)}</p>
        <p className="text-xs text-text-muted">€{formatMoney(product.priceExclTax)} excl. tax</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          aria-label={`Edit ${product.productName}`}
          className="rounded-md p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          onClick={onEdit}
          type="button"
        >
          <EditIcon />
        </button>
        <button
          aria-label={`Delete ${product.productName}`}
          className="rounded-md p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          onClick={onDelete}
          type="button"
        >
          <DeleteIcon />
        </button>
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

function PlaceholderImageIcon() {
  return (
    <div className="flex h-full w-full items-center justify-center text-text-muted">
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <rect height="18" rx="2" ry="2" width="18" x="3" y="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
