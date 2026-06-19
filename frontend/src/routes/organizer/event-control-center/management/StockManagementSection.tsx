import { useMemo, useState, type ReactNode } from 'react';

import { MinusIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { ChipFilter } from '../components/ChipFilter';
import { EmptyState } from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  onProductStockChange: (standId: string, product: Product, productStock: number) => Promise<void>;
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
                    key={`${product._id}-${product.productStock}`}
                    product={product}
                    onSave={(nextStock) =>
                      onProductStockChange(product.standId, product, nextStock)
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
  onSave: (productStock: number) => Promise<void>;
  product: StockProductEntry;
}) {
  const [draftStock, setDraftStock] = useState(String(product.productStock));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedStock = parseStockDraft(draftStock);
  const isTerminated = product.productStatus === 'TERMINATED';
  const isDirty = parsedStock !== null && parsedStock !== product.productStock;
  const canSave = !isTerminated && isDirty && !isSaving;

  function stepStock(delta: number) {
    const base = parsedStock ?? product.productStock;
    setDraftStock(String(Math.max(0, base + delta)));
    setError(null);
  }

  async function handleSave() {
    if (parsedStock === null) {
      setError('Enter a non-negative whole number.');
      return;
    }
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave(parsedStock);
    } catch {
      setError('Stock could not be saved.');
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
          <span className="font-semibold tabular-nums text-text">{product.productStock}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 md:items-end">
        <div className="flex items-center gap-2">
          <IconButton
            disabled={isTerminated || isSaving || (parsedStock ?? product.productStock) <= 0}
            label={`Decrease ${product.productName} stock`}
            onClick={() => stepStock(-1)}
          >
            <MinusIcon />
          </IconButton>
          <input
            aria-label={`${product.productName} stock`}
            className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-center text-sm font-semibold tabular-nums text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
            disabled={isTerminated || isSaving}
            min={0}
            onChange={(event) => {
              setDraftStock(event.target.value);
              setError(null);
            }}
            step={1}
            type="number"
            value={draftStock}
          />
          <IconButton
            disabled={isTerminated || isSaving}
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
        ) : parsedStock === null ? (
          <p className="text-xs text-danger">Enter a non-negative whole number.</p>
        ) : isDirty ? (
          <p className="text-xs text-text-muted">Unsaved stock change.</p>
        ) : (
          <p className="text-xs text-text-muted">Stock is up to date.</p>
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
