import { useMemo, useState, type ReactNode } from 'react';

import { type LiveOrder, type LiveOrderItem } from '@/api/eventControlCenter';
import { AlertDialog } from '@/components/feedback';
import {
  ChevronDownIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  UnlockIcon,
  WarningTriangleIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import type { Product } from '@/types/product';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';

const LIVE_ORDERS_PER_PAGE = 5;

type CancelItemsRequest = {
  orderId: string;
  itemIds: string[];
};

export function EventControlCenterManagementPage({
  liveOrders,
  onCancelOrder,
  onCancelOrderItems,
  onProductPauseChange,
  onProductStockChange,
  onStandPauseChange,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onProductStockChange: (standId: string, product: Product, productStock: number) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}) {
  const [liveOrdersStandId, setLiveOrdersStandId] = useState('all');
  const selectedLiveOrdersStand =
    liveOrdersStandId === 'all'
      ? null
      : (stands.find((stand) => stand._id === liveOrdersStandId) ?? null);
  const visibleOrders = useMemo(
    () =>
      liveOrdersStandId === 'all'
        ? liveOrders
        : liveOrders.filter((order) => order.standIds.includes(liveOrdersStandId)),
    [liveOrders, liveOrdersStandId],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <CardTitle>
              Live Orders {selectedLiveOrdersStand ? `- ${selectedLiveOrdersStand.standName}` : ''}
            </CardTitle>
            <StandChipFilters
              ariaLabel="Live orders stand filter"
              selectedStandId={liveOrdersStandId}
              stands={stands}
              onSelectStand={setLiveOrdersStandId}
            />
          </div>
        </CardHeader>
        <CardContent>
          <LiveOrdersTable
            orders={visibleOrders}
            stands={stands}
            onCancelOrder={onCancelOrder}
            onCancelOrderItems={onCancelOrderItems}
          />
        </CardContent>
      </Card>

      <StockManagementSection
        productsByStand={productsByStand}
        stands={stands}
        onProductStockChange={onProductStockChange}
      />

      <Card>
        <CardHeader>
          <CardTitle>Operational Pausing</CardTitle>
        </CardHeader>
        <CardContent>
          {stands.length > 0 ? (
            <div className="space-y-4">
              {stands.map((stand) => (
                <StandPausePanel
                  key={stand._id}
                  liveOrders={liveOrders}
                  onCancelOrderItems={onCancelOrderItems}
                  onProductPauseChange={onProductPauseChange}
                  onStandPauseChange={onStandPauseChange}
                  products={productsByStand[stand._id] ?? []}
                  stand={stand}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No stands configured"
              message="Create stands before station or product pausing can be managed."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type StockProductEntry = Product & {
  standName: string;
};

type StockProductGroup = {
  products: StockProductEntry[];
  standId: string;
  standName: string;
};

type StockFilterOption = {
  label: string;
  value: string;
};

function StockManagementSection({
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

  function handleSelectStand(standId: string) {
    setSelectedStandId(standId);
  }

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
          <StandChipFilters
            ariaLabel="Stock management booth filter"
            selectedStandId={selectedStandId}
            stands={productStands}
            onSelectStand={handleSelectStand}
          />
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

function StandChipFilters({
  ariaLabel,
  onSelectStand,
  selectedStandId,
  stands,
}: {
  ariaLabel: string;
  onSelectStand: (standId: string) => void;
  selectedStandId: string;
  stands: Pick<Stand, '_id' | 'standName'>[];
}) {
  return (
    <div className="w-full space-y-3 lg:max-w-xl lg:justify-self-end">
      <StockChipFilter
        ariaLabel={ariaLabel}
        label="Stands"
        options={stands.map((stand) => ({ label: stand.standName, value: stand._id }))}
        selectedValue={selectedStandId}
        resetValue={selectedStandId !== 'all' ? 'all' : undefined}
        onSelect={onSelectStand}
      />
    </div>
  );
}

function StockChipFilter({
  ariaLabel,
  label,
  onSelect,
  options,
  resetValue,
  selectedValue,
}: {
  ariaLabel: string;
  label: string;
  onSelect: (value: string) => void;
  options: StockFilterOption[];
  resetValue?: string;
  selectedValue: string;
}) {
  return (
    <div className="relative space-y-2">
      <p className="text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div
        aria-label={ariaLabel}
        className="flex justify-end gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
      >
        {options.map((option) => (
          <button
            aria-pressed={selectedValue === option.value}
            className={[
              'inline-flex max-w-48 shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-colors duration-200 ease-out',
              selectedValue === option.value
                ? 'border-accent bg-accent text-[var(--color-button-text)] shadow-[0_10px_24px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]'
                : 'border-border bg-surface text-text hover:border-accent/30 hover:bg-surface-muted',
            ].join(' ')}
            key={option.value}
            title={option.label}
            type="button"
            onClick={() =>
              onSelect(selectedValue === option.value && resetValue ? resetValue : option.value)
            }
          >
            <span className="truncate">{option.label}</span>
            {selectedValue === option.value && resetValue && (
              <span aria-hidden className="text-xs font-bold leading-none">
                x
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
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

function LiveOrdersTable({
  orders,
  stands,
  onCancelOrder,
  onCancelOrderItems,
}: {
  orders: LiveOrder[];
  stands: Stand[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
}) {
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [selectedItemIdsByOrder, setSelectedItemIdsByOrder] = useState<Record<string, string[]>>(
    {},
  );
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancellingItemOrderId, setCancellingItemOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingCancellation, setPendingCancellation] = useState<
    | { type: 'order'; order: LiveOrder }
    | { type: 'items'; order: LiveOrder; itemIds: string[] }
    | null
  >(null);
  const standNameById = useMemo(
    () => new Map(stands.map((stand) => [stand._id, stand.standName])),
    [stands],
  );
  const totalPages = Math.max(1, Math.ceil(orders.length / LIVE_ORDERS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageOrders = orders.slice(
    (safeCurrentPage - 1) * LIVE_ORDERS_PER_PAGE,
    safeCurrentPage * LIVE_ORDERS_PER_PAGE,
  );

  function toggleExpanded(orderId: string) {
    const willCollapse = expandedOrderIds.has(orderId);
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });

    if (willCollapse) {
      setSelectedItemIdsByOrder((selected) => {
        const next = { ...selected };
        delete next[orderId];
        return next;
      });
    }
  }

  function toggleItemSelection(orderId: string, itemId: string) {
    setSelectedItemIdsByOrder((current) => {
      const selected = current[orderId] ?? [];
      const nextSelected = selected.includes(itemId)
        ? selected.filter((selectedItemId) => selectedItemId !== itemId)
        : [...selected, itemId];

      return {
        ...current,
        [orderId]: nextSelected,
      };
    });
  }

  function toggleAllItems(order: LiveOrder, checked: boolean) {
    const cancellableItemIds = getCancellableOrderItems(order).map((item) => item.itemId);
    setSelectedItemIdsByOrder((current) => ({
      ...current,
      [order._id]: checked ? cancellableItemIds : [],
    }));
  }

  async function confirmCancellation() {
    const cancellation = pendingCancellation;
    if (!cancellation) return;

    setPendingCancellation(null);
    if (cancellation.type === 'order') {
      setCancellingOrderId(cancellation.order._id);
      try {
        await onCancelOrder(cancellation.order._id);
      } finally {
        setCancellingOrderId(null);
      }
      return;
    }

    setCancellingItemOrderId(cancellation.order._id);
    try {
      await onCancelOrderItems(cancellation.order._id, cancellation.itemIds);
      setSelectedItemIdsByOrder((current) => ({
        ...current,
        [cancellation.order._id]: [],
      }));
    } finally {
      setCancellingItemOrderId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <EmptyState title="No live orders" message="Paid orders with open items will appear here." />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[8rem_minmax(0,1fr)_8rem_8rem_2rem] gap-4 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted md:grid">
          <span>Order</span>
          <span>Stands</span>
          <span>Status</span>
          <span>Total</span>
          <span className="sr-only">Details</span>
        </div>
        {pageOrders.map((order) => (
          <LiveOrderRow
            cancellingItemOrderId={cancellingItemOrderId}
            cancellingOrderId={cancellingOrderId}
            expanded={expandedOrderIds.has(order._id)}
            key={order._id}
            onCancelItems={(itemIds) => setPendingCancellation({ type: 'items', order, itemIds })}
            onCancelOrder={() => setPendingCancellation({ type: 'order', order })}
            onToggleAllItems={(checked) => toggleAllItems(order, checked)}
            onToggleExpanded={() => toggleExpanded(order._id)}
            onToggleItem={(itemId) => toggleItemSelection(order._id, itemId)}
            order={order}
            selectedItemIds={selectedItemIdsByOrder[order._id] ?? []}
            standNameById={standNameById}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
            const isActive = page === safeCurrentPage;

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'h-8 min-w-8 rounded-md border px-3 text-sm font-semibold transition-colors',
                  isActive
                    ? 'border-accent bg-accent text-[var(--color-button-text)]'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text',
                ].join(' ')}
                key={page}
                onClick={() => setCurrentPage(page)}
                type="button"
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <AlertDialog
        acknowledgeLabel="Cancel order"
        cancelLabel="Keep order"
        message={
          pendingCancellation?.type === 'order'
            ? `All not-ready items in order #${pendingCancellation.order.orderNumber} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => setPendingCancellation(null)}
        title="Cancel order?"
      />

      <AlertDialog
        acknowledgeLabel="Cancel items"
        cancelLabel="Keep items"
        message={
          pendingCancellation?.type === 'items'
            ? `${pendingCancellation.itemIds.length} selected item${
                pendingCancellation.itemIds.length === 1 ? '' : 's'
              } in order #${pendingCancellation.order.orderNumber} will be cancelled.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => setPendingCancellation(null)}
        title="Cancel selected items?"
      />
    </>
  );
}

function LiveOrderRow({
  cancellingItemOrderId,
  cancellingOrderId,
  expanded,
  onCancelItems,
  onCancelOrder,
  onToggleAllItems,
  onToggleExpanded,
  onToggleItem,
  order,
  selectedItemIds,
  standNameById,
}: {
  cancellingItemOrderId: string | null;
  cancellingOrderId: string | null;
  expanded: boolean;
  onCancelItems: (itemIds: string[]) => void;
  onCancelOrder: () => void;
  onToggleAllItems: (checked: boolean) => void;
  onToggleExpanded: () => void;
  onToggleItem: (itemId: string) => void;
  order: LiveOrder;
  selectedItemIds: string[];
  standNameById: Map<string, string>;
}) {
  const cancellableItems = getCancellableOrderItems(order);
  const allCancellableItemsSelected =
    cancellableItems.length > 0 && selectedItemIds.length === cancellableItems.length;
  const someItemsSelected = selectedItemIds.length > 0;
  const standNames = order.standIds.map((standId) => standNameById.get(standId) ?? 'Unknown stand');
  const standSummary = standNames.join(', ');

  return (
    <div className="border-t border-border first:border-t-0">
      <button
        aria-expanded={expanded}
        className="grid w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted/50 md:grid-cols-[8rem_minmax(0,1fr)_8rem_8rem_2rem] md:items-center md:gap-4"
        onClick={onToggleExpanded}
        type="button"
      >
        <span>
          <span className="block font-semibold text-text">#{order.orderNumber}</span>
          <span className="block text-xs text-text-muted">{order.pickupCode}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-text">{standSummary}</span>
          <span className="mt-1 block text-xs text-text-muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'} across{' '}
            {standNames.length} stand{standNames.length === 1 ? '' : 's'} ·{' '}
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
        <OrderStatusBadge status={order.status} />
        <span className="text-sm font-medium text-text">
          EUR {formatMoney(order.totalPriceIncludingTax)}
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted md:justify-self-end">
          <ChevronDownIcon
            className={['transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-muted/40 px-4 py-4">
          <div className="divide-y divide-border rounded-md border border-border bg-surface">
            <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
                <input
                  checked={allCancellableItemsSelected}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  disabled={cancellableItems.length === 0}
                  onChange={(event) => onToggleAllItems(event.target.checked)}
                  type="checkbox"
                />
                Select cancellable items
              </label>
              <Button
                className="w-full whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
                disabled={
                  someItemsSelected
                    ? cancellingItemOrderId === order._id
                    : cancellingOrderId === order._id || cancellableItems.length === 0
                }
                onClick={() => {
                  if (someItemsSelected) onCancelItems(selectedItemIds);
                  else onCancelOrder();
                }}
                size="sm"
                variant="outline"
              >
                {someItemsSelected
                  ? `Cancel selected items (${selectedItemIds.length})`
                  : 'Cancel order'}
              </Button>
            </div>
            {order.items.map((item) => (
              <LiveOrderItemRow
                checked={selectedItemIds.includes(item.itemId)}
                item={item}
                key={item.itemId}
                onToggle={() => {
                  if (!item.readyAt) onToggleItem(item.itemId);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveOrderItemRow({
  checked,
  item,
  onToggle,
}: {
  checked: boolean;
  item: LiveOrderItem;
  onToggle: () => void;
}) {
  const isReady = Boolean(item.readyAt);
  return (
    <label
      className={[
        'grid gap-3 px-3 py-3 hover:bg-surface-muted sm:grid-cols-[1.5rem_minmax(0,1fr)_7rem_6rem] sm:items-center',
        isReady ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        checked={checked}
        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
        disabled={isReady}
        onChange={onToggle}
        type="checkbox"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text">{item.productName}</p>
        {item.customerComment && (
          <p className="mt-1 truncate text-xs text-text-muted">{item.customerComment}</p>
        )}
      </div>
      <OrderStatusBadge status={item.status} />
      <p className="text-sm font-medium text-text sm:text-right">
        EUR {formatMoney(item.unitPriceIncludingTax)}
      </p>
    </label>
  );
}

function OrderStatusBadge({ status }: { status: LiveOrder['status'] }) {
  const label = status === 'READY' ? 'Ready' : status === 'PREPARING' ? 'Preparing' : 'In line';
  const className =
    status === 'READY'
      ? 'border-success/30 bg-success/10 text-success'
      : status === 'PREPARING'
        ? 'border-accent/30 bg-accent-soft text-accent'
        : 'border-border bg-surface text-text-muted';

  return (
    <span
      className={[
        'inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function StandPausePanel({
  liveOrders,
  onCancelOrderItems,
  onProductPauseChange,
  onStandPauseChange,
  products,
  stand,
}: {
  liveOrders: LiveOrder[];
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  products: Product[];
  stand: Stand;
}) {
  const [isCancellingStand, setIsCancellingStand] = useState(false);
  const [pendingBulkCancel, setPendingBulkCancel] = useState<{
    label: string;
    requests: CancelItemsRequest[];
  } | null>(null);
  const productIds = products.map((product) => product._id);
  const standCancelRequests = getCancelRequestsForProducts(liveOrders, new Set(productIds));
  const standCancellableItemCount = countCancelItems(standCancelRequests);
  const isStandPaused = stand.standStatus === 'PAUSED';

  async function cancelRequests(requests: CancelItemsRequest[]) {
    setIsCancellingStand(true);
    try {
      await Promise.all(
        requests.map((request) => onCancelOrderItems(request.orderId, request.itemIds)),
      );
    } finally {
      setIsCancellingStand(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-background">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-text">{stand.standName}</h3>
            <p className="mt-1 text-xs text-text-muted">
              Stand pause blocks new orders while existing orders stay visible.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <StandAvailabilityControl onPauseChange={onStandPauseChange} stand={stand} />
            {isStandPaused ? (
              <Button
                className="w-full whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
                disabled={isCancellingStand || standCancellableItemCount === 0}
                onClick={() =>
                  setPendingBulkCancel({
                    label: stand.standName,
                    requests: standCancelRequests,
                  })
                }
                size="sm"
                variant="outline"
              >
                Cancel Everything ({standCancellableItemCount})
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {products.length > 0 ? (
            products.map((product) => (
              <ProductPauseTile
                liveOrders={liveOrders}
                key={product._id}
                onCancelOrderItems={onCancelOrderItems}
                product={product}
                standId={stand._id}
                onPauseChange={onProductPauseChange}
              />
            ))
          ) : (
            <p className="text-sm text-text-muted">No products configured for this stand.</p>
          )}
        </div>
      </section>
      <AlertDialog
        acknowledgeLabel="Cancel everything"
        cancelLabel="Keep items"
        message={
          pendingBulkCancel
            ? `${countCancelItems(pendingBulkCancel.requests)} not-ready item${
                countCancelItems(pendingBulkCancel.requests) === 1 ? '' : 's'
              } for ${pendingBulkCancel.label} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => {
          const cancellation = pendingBulkCancel;
          setPendingBulkCancel(null);
          if (cancellation) void cancelRequests(cancellation.requests);
        }}
        onCancel={() => setPendingBulkCancel(null)}
        title="Cancel everything?"
      />
    </>
  );
}

function StandAvailabilityControl({
  onPauseChange,
  stand,
}: {
  onPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  stand: Stand;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const isLive = stand.standStatus === 'LIVE';

  async function handleToggle() {
    setIsSaving(true);
    try {
      await onPauseChange(stand, isLive);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        aria-label={`${stand.standName} is ${isLive ? 'open and accepting new orders' : 'paused for new orders'}.`}
        className={[
          'relative h-11 w-full rounded-full border border-border bg-surface p-1 text-sm shadow-sm transition-colors sm:w-64',
          isSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        ].join(' ')}
        disabled={isSaving}
        onClick={() => void handleToggle()}
        type="button"
      >
        <span className="grid h-full grid-cols-2 items-center rounded-full bg-surface-muted">
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-accent' : 'text-text-muted',
            ].join(' ')}
          >
            <UnlockIcon className="h-4 w-4" />
            Open
          </span>
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-text-muted' : 'text-danger',
            ].join(' ')}
          >
            <LockIcon className="h-4 w-4" />
            Paused
          </span>
        </span>
        <span
          className={[
            'absolute inset-y-1 flex w-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-full px-3 font-semibold text-[var(--color-button-text)] shadow-sm transition-[left,right,background-color]',
            isLive ? 'left-1 bg-accent' : 'right-1 bg-danger',
          ].join(' ')}
        >
          {isLive ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
          {isLive ? 'Open' : 'Paused'}
        </span>
      </button>
    </div>
  );
}

function ProductPauseTile({
  liveOrders,
  onCancelOrderItems,
  onPauseChange,
  product,
  standId,
}: {
  liveOrders: LiveOrder[];
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  product: Product;
  standId: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<CancelItemsRequest[] | null>(null);
  const isLive = product.productStatus === 'LIVE';
  const isPaused = product.productStatus === 'PAUSED';
  const isTerminated = product.productStatus === 'TERMINATED';
  const cancelRequests = getCancelRequestsForProducts(liveOrders, new Set([product._id]));
  const cancellableItemCount = countCancelItems(cancelRequests);
  const availabilityText = isTerminated
    ? 'terminated product'
    : isPaused
      ? 'hidden from new orders'
      : 'available for new orders';

  async function handleAvailabilityChange(checked: boolean) {
    if (isTerminated) return;
    setIsSaving(true);
    try {
      await onPauseChange(standId, product, !checked);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancelEverything(requests: CancelItemsRequest[]) {
    setIsCancelling(true);
    try {
      await Promise.all(
        requests.map((request) => onCancelOrderItems(request.orderId, request.itemIds)),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <div
        className={[
          'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3',
          isTerminated ? 'opacity-70' : '',
        ].join(' ')}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{product.productName}</p>
          <p className="mt-1 text-xs text-text-muted">
            EUR {formatMoney(product.priceIncludingTax)} · {availabilityText}
          </p>
          {isPaused ? (
            <Button
              className="mt-3 whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
              disabled={isCancelling || cancellableItemCount === 0}
              onClick={() => setPendingCancel(cancelRequests)}
              size="sm"
              variant="outline"
            >
              Cancel Everything ({cancellableItemCount})
            </Button>
          ) : null}
        </div>
        <Toggle
          checked={isLive}
          disabled={isSaving || isTerminated}
          label={`${product.productName} available for orders`}
          onChange={(checked) => void handleAvailabilityChange(checked)}
        />
      </div>
      <AlertDialog
        acknowledgeLabel="Cancel everything"
        cancelLabel="Keep items"
        message={
          pendingCancel
            ? `${countCancelItems(pendingCancel)} not-ready item${
                countCancelItems(pendingCancel) === 1 ? '' : 's'
              } for ${product.productName} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => {
          const cancellation = pendingCancel;
          setPendingCancel(null);
          if (cancellation) void handleCancelEverything(cancellation);
        }}
        onCancel={() => setPendingCancel(null)}
        title="Cancel everything?"
      />
    </>
  );
}

function getCancellableOrderItems(order: LiveOrder): LiveOrderItem[] {
  return order.items.filter((item) => !item.readyAt);
}

function getCancelRequestsForProducts(
  orders: LiveOrder[],
  productIds: Set<string>,
): CancelItemsRequest[] {
  return orders
    .map((order) => ({
      orderId: order._id,
      itemIds: order.items
        .filter((item) => productIds.has(item.productId) && !item.readyAt)
        .map((item) => item.itemId),
    }))
    .filter((request) => request.itemIds.length > 0);
}

function countCancelItems(requests: CancelItemsRequest[]): number {
  return requests.reduce((total, request) => total + request.itemIds.length, 0);
}

function EmptyState({
  title,
  message,
  icon = false,
}: {
  title: string;
  message: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center">
      {icon && <WarningTriangleIcon className="mx-auto mb-3 h-7 w-7 text-text-muted" />}
      <p className="font-semibold text-text">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">{message}</p>
    </div>
  );
}
