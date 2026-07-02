import { useMemo, useState, type ReactNode } from 'react';

import { MinusIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { Product, StockMode } from '@/types/product';
import type { Stand } from '@/types/stand';
import { ChipFilter } from '../components/ChipFilter';
import { EmptyState } from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductStockChangedError } from '@/api/products';

type StockProductEntry = Product & {
  standName: string;
};

type StockProductGroup = {
  products: StockProductEntry[];
  standId: string;
  standName: string;
};

export function StockManagementSection({
  onProductStockChange,
  productsByStand,
  stands,
}: {
  onProductStockChange: (
    standId: string,
    product: Product,
    productStock: number,
    stockMode: StockMode,
  ) => Promise<void>;
  productsByStand: Record<string, Product[]>;
  stands: Stand[];
}) {
  const [selectedStandId, setSelectedStandId] = useState('all');
  const productStands = useMemo(
    () => stands.filter((stand) => (productsByStand[stand._id] ?? []).length > 0),
    [productsByStand, stands],
  );
  const boothSelected = selectedStandId !== 'all';
  const visibleGroups = useMemo((): StockProductGroup[] => {
    const standScope = boothSelected
      ? productStands.filter((stand) => stand._id === selectedStandId)
      : productStands;

    return standScope
      .map((stand) => ({
        standId: stand._id,
        standName: stand.standName,
        products: [...(productsByStand[stand._id] ?? [])]
          .sort((left, right) => left.productName.localeCompare(right.productName))
          .map((product) => ({ ...product, standName: stand.standName })),
      }))
      .filter((group) => group.products.length > 0);
  }, [boothSelected, productStands, productsByStand, selectedStandId]);
  const visibleProductCount = visibleGroups.reduce(
    (total, group) => total + group.products.length,
    0,
  );

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Stock Management</CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              Adjust live product stock without changing product availability.
            </p>
          </div>
          <div className="w-full space-y-3 lg:max-w-xl lg:justify-self-end">
            <ChipFilter
              ariaLabel="Stock management booth filter"
              label="Stands"
              options={productStands.map((stand) => ({ label: stand.standName, value: stand._id }))}
              resetValue={selectedStandId !== 'all' ? 'all' : undefined}
              selectedValue={selectedStandId}
              onSelect={setSelectedStandId}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visibleProductCount > 0 ? (
          <div className="space-y-3">
            {visibleGroups.map((group) => (
              <section className="space-y-3" key={group.standId}>
                {!boothSelected && (
                  <h3 className="text-sm font-semibold text-text-muted">{group.standName}</h3>
                )}
                {group.products.map((product) => (
                  <StockProductRow
                    key={product._id}
                    product={product}
                    onSave={(nextStock, stockMode) =>
                      onProductStockChange(product.standId, product, nextStock, stockMode)
                    }
                  />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No products found"
            message="Products for the selected filter will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}

function StockProductRow({
  onSave,
  product,
}: {
  onSave: (productStock: number, stockMode: StockMode) => Promise<void>;
  product: StockProductEntry;
}) {
  const [draftState, setDraftState] = useState(() => ({
    productId: product._id,
    stockMode: product.stockMode,
    productStock: product.productStock,
    value: String(product.productStock),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let draftStock = draftState.value;
  if (
    draftState.productId !== product._id ||
    draftState.productStock !== product.productStock ||
    draftState.stockMode !== product.stockMode
  ) {
    draftStock = String(product.productStock);
    setDraftState({
      productId: product._id,
      stockMode: product.stockMode,
      productStock: product.productStock,
      value: draftStock,
    });
  }
  const parsedStock = parseStockDraft(draftStock);
  const draftStockMode = draftState.stockMode;
  const isTerminated = product.productStatus === 'TERMINATED';
  const validStock = draftStockMode === 'UNLIMITED' || parsedStock !== null;
  const isDirty =
    validStock && (draftStockMode !== product.stockMode || parsedStock !== product.productStock);
  const canSave = !isTerminated && validStock && isDirty && !isSaving;

  function stepStock(delta: number) {
    const base = parsedStock ?? product.productStock;
    setDraftState((current) => ({
      ...current,
      stockMode: 'TRACKED',
      value: String(Math.max(0, base + delta)),
    }));
    setError(null);
  }

  async function handleSave() {
    if (draftStockMode === 'TRACKED' && parsedStock === null) {
      setError('Enter a non-negative whole number.');
      return;
    }
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsedStock ?? product.productStock, draftStockMode);
    } catch (saveError) {
      setError(
        saveError instanceof ProductStockChangedError
          ? 'Stock changed during editing. The current value was loaded.'
          : 'Stock could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className={[
        'grid gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-[minmax(10rem,1fr)_auto] md:items-center',
        isTerminated ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-text">{product.productName}</h3>
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
            {product.standName}
          </span>
          <ProductStatusBadge status={product.productStatus} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Current stock:{' '}
          <span className="font-semibold tabular-nums text-text">
            {product.stockMode === 'TRACKED' ? product.productStock : 'Unlimited'}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2 md:items-end">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            checked={draftStockMode === 'TRACKED'}
            className="h-4 w-4 accent-accent"
            disabled={isTerminated || isSaving}
            onChange={(event) => {
              setDraftState((current) => ({
                ...current,
                stockMode: event.target.checked ? 'TRACKED' : 'UNLIMITED',
              }));
              setError(null);
            }}
            type="checkbox"
          />
          Track stock
        </label>
        <div className="flex items-center gap-2">
          <IconButton
            disabled={
              isTerminated ||
              isSaving ||
              draftStockMode === 'UNLIMITED' ||
              (parsedStock ?? product.productStock) <= 0
            }
            label={`Decrease ${product.productName} stock`}
            onClick={() => stepStock(-1)}
          >
            <MinusIcon />
          </IconButton>
          <input
            aria-label={`${product.productName} stock`}
            className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-center text-sm font-semibold tabular-nums text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
            disabled={isTerminated || isSaving || draftStockMode === 'UNLIMITED'}
            min={0}
            onChange={(event) => {
              setDraftState((current) => ({
                ...current,
                value: event.target.value,
              }));
              setError(null);
            }}
            step={1}
            type="number"
            value={draftStock}
          />
          <IconButton
            disabled={isTerminated || isSaving || draftStockMode === 'UNLIMITED'}
            label={`Increase ${product.productName} stock`}
            onClick={() => stepStock(1)}
          >
            <PlusIcon />
          </IconButton>
          <Button disabled={!canSave} onClick={() => void handleSave()} size="sm">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {error ? (
          <p className="text-xs font-medium text-danger">{error}</p>
        ) : draftStockMode === 'TRACKED' && parsedStock === null ? (
          <p className="text-xs text-danger">Enter a non-negative whole number.</p>
        ) : isDirty ? (
          <p className="text-xs text-text-muted">Unsaved stock change.</p>
        ) : (
          <p className="text-xs text-text-muted">
            {draftStockMode === 'TRACKED' ? 'Stock is up to date.' : 'Stock is unlimited.'}
          </p>
        )}
      </div>
    </section>
  );
}

function ProductStatusBadge({ status }: { status: Product['productStatus'] }) {
  const className =
    status === 'LIVE'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'PAUSED'
        ? 'border-danger/30 bg-danger/10 text-danger'
        : 'border-border bg-surface-muted text-text-muted';
  const label = status === 'LIVE' ? 'Live' : status === 'PAUSED' ? 'Paused' : 'Terminated';

  return (
    <span
      className={['rounded-full border px-2 py-0.5 text-xs font-semibold', className].join(' ')}
    >
      {label}
    </span>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function parseStockDraft(value: string): number | null {
  if (value.trim() === '') return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}
