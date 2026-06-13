import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import {
  formatMoney,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from '@/types/product';
import type { EventActionResult } from './data';

interface ProductDialogProps {
  product: Product | null; // null = create mode
  standId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Accept both "12.50" and "12,50": normalize the comma, then require a plain
// number with at most two decimals. Rejecting >2 decimals (instead of letting
// Number round them) keeps the entered value exact — no silent rounding.
function parseHundredths(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  // n has ≤2 decimals, so n*100 is an integer; round() only clears float dust.
  return Math.round(n * 100);
}

// Parse a user-entered price (e.g. "12.50" or "12,50") to integer cents.
function parseCents(value: string): number | null {
  return parseHundredths(value);
}

// Parse a user-entered percentage (e.g. "19" or "19,5") to integer basis points.
function parseTaxRate(value: string): number | null {
  const bp = parseHundredths(value);
  if (bp === null || bp > 10000) return null; // 100.00% max
  return bp;
}

function parseStock(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function ProductDialog({ product, standId, isOpen, onClose }: ProductDialogProps) {
  const fetcher = useFetcher<EventActionResult>();

  const [productName, setProductName] = useState(product?.productName ?? '');
  const [price, setPrice] = useState(product ? formatMoney(product.priceIncludingTax) : '');
  const [taxRate, setTaxRate] = useState(product ? String(product.taxRate / 100) : '19');
  const [instantProduct, setInstantProduct] = useState(product?.instantProduct ?? false);
  const [stock, setStock] = useState(product ? String(product.productStock) : '0');
  const [description, setDescription] = useState(product?.productDescription ?? '');
  const [imageUrl, setImageUrl] = useState(product?.productImageUrl ?? '');
  // Reset on each URL edit so a new URL gets a fresh load attempt.
  const [previewBroken, setPreviewBroken] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleImageUrlChange(value: string) {
    setImageUrl(value);
    setPreviewBroken(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const wasSubmittingRef = useRef(false);
  const isHandlingSubmitRef = useRef(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      wasSubmittingRef.current = true;
    } else if (fetcher.state === 'idle') {
      isHandlingSubmitRef.current = false;
      if (wasSubmittingRef.current) {
        wasSubmittingRef.current = false;
        if (fetcher.data?.ok) onClose();
      }
    }
  }, [fetcher.state, fetcher.data, onClose]);

  if (!isOpen) return null;

  const isEdit = !!product;
  const busy = fetcher.state !== 'idle';
  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isHandlingSubmitRef.current) return;

    const name = productName.trim();
    if (!name) {
      setValidationError('Product name is required');
      return;
    }
    const priceIncludingTax = parseCents(price);
    if (priceIncludingTax === null) {
      setValidationError('Enter a valid price with at most two decimals (e.g. 12.50 or 12,50)');
      return;
    }
    const taxRateBp = parseTaxRate(taxRate);
    if (taxRateBp === null) {
      setValidationError('Enter a valid tax rate between 0 and 100 (e.g. 19 or 19,5)');
      return;
    }
    const productStock = parseStock(stock);
    if (productStock === null) {
      setValidationError('Enter a valid initial stock amount');
      return;
    }
    setValidationError(null);

    const description_ = description.trim() || null;
    const productImageUrl = imageUrl.trim() || null;

    isHandlingSubmitRef.current = true;
    if (isEdit) {
      const patch: UpdateProductInput = {
        productName: name,
        productDescription: description_,
        priceIncludingTax,
        taxRate: taxRateBp,
        productImageUrl,
        instantProduct,
        productStock,
      };
      fetcher.submit(
        { intent: 'updateProduct', productId: product._id, patch } as unknown as Parameters<
          typeof fetcher.submit
        >[0],
        { method: 'post', encType: 'application/json' },
      );
    } else {
      const patch: CreateProductInput = {
        productName: name,
        productDescription: description_,
        priceIncludingTax,
        taxRate: taxRateBp,
        productImageUrl,
        instantProduct,
        productStock,
      };
      fetcher.submit(
        { intent: 'createProduct', standId, patch } as unknown as Parameters<
          typeof fetcher.submit
        >[0],
        { method: 'post', encType: 'application/json' },
      );
    }
  }

  const error = validationError ?? actionError;

  return (
    // z-[1100] sits above the navbar (z-[1001])
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-black/40" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <section
          aria-labelledby="product-dialog-title"
          aria-modal="true"
          className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
          role="dialog"
        >
          <h2 id="product-dialog-title" className="mb-4 text-xl font-semibold text-text">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>

          {error && (
            <div className="mb-4 rounded bg-danger/10 p-3 text-sm text-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              id="product-name"
              label="Product Name *"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Lager 0.5L"
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="product-price"
                label="Price incl. tax *"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <TextField
                id="product-tax"
                label="Tax rate (%) *"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="19"
                inputMode="decimal"
              />
            </div>

            <TextField
              id="product-stock"
              label="Initial Stock *"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              inputMode="numeric"
            />

            {/* Fulfillment type — instant (served immediately) vs manufactured. */}
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-text">Fulfillment type</legend>
              <div className="space-y-2">
                {[
                  {
                    value: true,
                    title: 'Instant',
                    description: 'Available immediately, no preparation',
                  },
                  {
                    value: false,
                    title: 'Manufactured',
                    description: 'Requires preparation before pickup',
                  },
                ].map((option) => {
                  const selected = instantProduct === option.value;
                  return (
                    <label
                      key={option.title}
                      className={[
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition',
                        selected
                          ? 'border-accent bg-accent-soft'
                          : 'border-border bg-surface hover:bg-surface-muted',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="product-fulfillment"
                        className="h-4 w-4 shrink-0 accent-accent"
                        checked={selected}
                        onChange={() => setInstantProduct(option.value)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-text">{option.title}</span>
                        <span className="block text-xs text-text-muted">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-text"
                htmlFor="product-description"
              >
                Description (Optional)
              </label>
              <textarea
                id="product-description"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent-soft"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown to customers"
                rows={3}
              />
            </div>

            <div>
              <TextField
                id="product-image-url"
                label="Image URL (Optional)"
                value={imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                placeholder="https://…"
                type="url"
              />
              {imageUrl.trim() &&
                (previewBroken ? (
                  <p className="mt-2 text-xs text-text-muted">
                    Preview unavailable — check the URL.
                  </p>
                ) : (
                  <div className="mt-2 h-40 overflow-hidden rounded-lg border border-border bg-surface-muted">
                    <img
                      alt="Product preview"
                      className="h-full w-full object-contain"
                      onError={() => setPreviewBroken(true)}
                      src={imageUrl.trim()}
                    />
                  </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
