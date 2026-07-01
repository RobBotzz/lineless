import { useEffect, useMemo, useState } from 'react';
import { useRevalidator } from 'react-router';

import { ApiError } from '@/api/client';
import {
  createProduct,
  deleteProductImage,
  updateProduct,
  uploadProductImage,
} from '@/api/products';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ImageDropzone } from '@/components/shared';
import {
  formatMoney,
  productImageSrc,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from '@/types/product';

// Mirrors the backend upload limits (config.upload). The server is the source of
// truth (it also checks the magic bytes); these just give instant feedback.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
// Returns null if the price exceeds €9,999.99 (999,999 cents).
function parseCents(value: string): number | null {
  const cents = parseHundredths(value);
  if (cents === null || cents > 999_999) return null;
  return cents;
}

// Parse a user-entered percentage (e.g. "19" or "19,5") to integer basis points.
function parseTaxRate(value: string): number | null {
  const bp = parseHundredths(value);
  if (bp === null || bp > 10000) return null; // 100.00% max
  return bp;
}

function parseStock(value: string): number | null {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 0 || n > 100_000) return null;
  return n;
}

export function ProductDialog({ product, standId, isOpen, onClose }: ProductDialogProps) {
  const revalidator = useRevalidator();

  const [productName, setProductName] = useState(product?.productName ?? '');
  const [price, setPrice] = useState(product ? formatMoney(product.priceIncludingTax) : '');
  const [taxRate, setTaxRate] = useState(product ? String(product.taxRate / 100) : '19');
  const [instantProduct, setInstantProduct] = useState(product?.instantProduct ?? false);
  const [stock, setStock] = useState(product ? String(product.productStock) : '0');
  const [description, setDescription] = useState(product?.productDescription ?? '');

  // Image state: a freshly picked file (uploaded on save), and a flag to drop the
  // existing image. The preview is derived from these below.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  // In create mode, the id of an already-created product. Set once createProduct
  // succeeds so a failed image upload (and a subsequent retry) updates that
  // product instead of creating a duplicate.
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Object URL for the picked file, revoked when it changes / on unmount.
  const filePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile],
  );
  useEffect(() => {
    if (!filePreview) return;
    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, saving]);

  if (!isOpen) return null;

  const isEdit = !!product;
  // New file wins; otherwise show the existing image unless it's marked for removal.
  const previewUrl =
    filePreview ?? (removeExistingImage || !product ? null : productImageSrc(product));

  function handleSelectImage(file: File) {
    setError(null);
    setRemoveExistingImage(false);
    setImageFile(file);
  }

  function handleRemoveImage() {
    setError(null);
    setImageFile(null);
    // Only existing (already-saved) images need an explicit delete on save.
    if (product?.productImageUrl) setRemoveExistingImage(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const name = productName.trim();
    if (!name) {
      setError('Product name is required');
      return;
    }
    const priceIncludingTax = parseCents(price);
    if (priceIncludingTax === null) {
      setError(
        'Enter a valid price up to €9,999.99 with at most two decimals (e.g. 12.50 or 12,50)',
      );
      return;
    }
    const taxRateBp = parseTaxRate(taxRate);
    if (taxRateBp === null) {
      setError('Enter a valid tax rate between 0 and 100 (e.g. 19 or 19,5)');
      return;
    }
    const productStock = parseStock(stock);
    if (productStock === null) {
      setError('Enter a valid initial stock amount between 0 and 100,000');
      return;
    }

    const productDescription = description.trim() || null;
    setError(null);
    setSaving(true);

    // Operate on the existing product, the one created on a previous (partly
    // failed) attempt, or create a fresh one.
    const existingProductId = product?._id ?? createdProductId;

    try {
      if (existingProductId) {
        const patch: UpdateProductInput = {
          productName: name,
          productDescription,
          priceIncludingTax,
          taxRate: taxRateBp,
          instantProduct,
          productStock,
        };
        await updateProduct(existingProductId, patch);
        // Image is a separate endpoint: upload a new one, or drop the old one.
        if (imageFile) {
          await uploadProductImage(existingProductId, imageFile);
        } else if (removeExistingImage && product?.productImageUrl) {
          await deleteProductImage(existingProductId);
        }
      } else {
        const patch: CreateProductInput = {
          productName: name,
          productDescription,
          priceIncludingTax,
          taxRate: taxRateBp,
          instantProduct,
          productStock,
        };
        // Create first to get the id, then attach the image if one was picked.
        // Remember the id so a later failure + retry never creates a duplicate.
        const created = await createProduct(standId, patch);
        setCreatedProductId(created._id);
        if (imageFile) {
          await uploadProductImage(created._id, imageFile);
        }
      }

      await revalidator.revalidate();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    // z-[1100] sits above the navbar (z-[1001])
    <div className="fixed inset-0 z-[1100] overflow-y-auto bg-black/40" role="presentation">
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <section
          aria-labelledby="product-dialog-title"
          aria-modal="true"
          className="w-full max-w-3xl rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
          role="dialog"
        >
          <h2 id="product-dialog-title" className="mb-4 text-xl font-semibold text-text">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>

          {error && (
            <div className="mb-4 rounded bg-danger/10 p-3 text-sm text-danger">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Two columns on wider viewports so the dialog stays short and uses
                the available width instead of forcing a long scroll. */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {/* Left column — core product fields */}
              <div className="space-y-4">
                <TextField
                  id="product-name"
                  label="Product Name *"
                  maxLength={100}
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
                  <legend className="mb-2 block text-sm font-medium text-text">
                    Fulfillment type
                  </legend>
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
                            <span className="block text-sm font-medium text-text">
                              {option.title}
                            </span>
                            <span className="block text-xs text-text-muted">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>

              {/* Right column — description and image */}
              <div className="space-y-4">
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
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description shown to customers"
                    rows={3}
                  />
                </div>

                <div>
                  <span className="mb-2 block text-sm font-medium text-text">
                    Product Image (Optional)
                  </span>
                  <ImageDropzone
                    previewUrl={previewUrl}
                    onSelect={handleSelectImage}
                    onRemove={handleRemoveImage}
                    onError={setError}
                    acceptedTypes={ACCEPTED_IMAGE_TYPES}
                    maxBytes={MAX_IMAGE_BYTES}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
