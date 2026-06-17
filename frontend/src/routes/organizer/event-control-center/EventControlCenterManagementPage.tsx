import { useMemo, useState } from 'react';

import { type LiveOrder, type LiveOrderItem } from '@/api/eventControlCenter';
import { AlertDialog } from '@/components/feedback';
import { ChevronDownIcon, LockIcon, UnlockIcon, WarningTriangleIcon } from '@/components/icons';
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
  onStandPauseChange,
  onSelectStand,
  selectedStandId,
  selectedStand,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  onSelectStand: (standId: string) => void;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
  selectedStandId: string;
  selectedStand: Stand | null;
}) {
  const visibleStands = useMemo(
    () =>
      selectedStandId === 'all' ? stands : stands.filter((stand) => stand._id === selectedStandId),
    [selectedStandId, stands],
  );
  const visibleOrders = useMemo(
    () =>
      selectedStandId === 'all'
        ? liveOrders
        : liveOrders.filter((order) => order.standIds.includes(selectedStandId)),
    [liveOrders, selectedStandId],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Stand Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft lg:hidden"
              onChange={(event) => onSelectStand(event.target.value)}
              value={selectedStandId}
            >
              <option value="all">All stands</option>
              {stands.map((stand) => (
                <option key={stand._id} value={stand._id}>
                  {stand.standName}
                </option>
              ))}
            </select>

            <div className="hidden space-y-2 lg:block">
              <StandFilterButton
                active={selectedStandId === 'all'}
                label="All stands"
                onClick={() => onSelectStand('all')}
              />
              {stands.map((stand) => (
                <StandFilterButton
                  active={selectedStandId === stand._id}
                  key={stand._id}
                  label={stand.standName}
                  onClick={() => onSelectStand(stand._id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Orders {selectedStand ? `- ${selectedStand.standName}` : ''}</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Operational Pausing</CardTitle>
          </CardHeader>
          <CardContent>
            {visibleStands.length > 0 ? (
              <div className="space-y-4">
                {visibleStands.map((stand) => (
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
    </div>
  );
}

function StandFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'w-full truncate rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-[var(--color-button-text)]'
          : 'text-text-muted hover:bg-surface-muted hover:text-text',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
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
