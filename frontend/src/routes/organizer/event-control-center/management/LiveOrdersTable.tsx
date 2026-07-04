import { useMemo, useRef, useState } from 'react';

import type { LiveOrder, LiveOrderItem } from '@/api/eventControlCenter';
import { AlertDialog } from '@/components/feedback';
import { ChevronDownIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/types/product';
import type { Stand } from '@/types/stand';
import { EmptyState } from '../components/EmptyState';
import { getCancellableOrderItems } from './cancellationUtils';

const LIVE_ORDERS_PER_PAGE = 5;

export function LiveOrdersTable({
  orders,
  pageResetKey,
  stands,
  onCancelOrder,
  onCancelOrderItems,
}: {
  orders: LiveOrder[];
  pageResetKey: string;
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
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [confirmingCancellation, setConfirmingCancellation] = useState(false);
  const confirmingCancellationRef = useRef(false);
  const [pageState, setPageState] = useState(() => ({
    currentPage: 1,
    resetKey: pageResetKey,
  }));
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
  let currentPage = Math.min(pageState.currentPage, totalPages);
  if (pageState.resetKey !== pageResetKey) {
    currentPage = 1;
    setPageState({ currentPage, resetKey: pageResetKey });
  } else if (pageState.currentPage !== currentPage) {
    setPageState({ currentPage, resetKey: pageResetKey });
  }
  const pageOrders = orders.slice(
    (currentPage - 1) * LIVE_ORDERS_PER_PAGE,
    currentPage * LIVE_ORDERS_PER_PAGE,
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
    if (confirmingCancellationRef.current) return;
    const cancellation = pendingCancellation;
    if (!cancellation) return;

    confirmingCancellationRef.current = true;
    setConfirmingCancellation(true);
    setCancellationError(null);
    if (cancellation.type === 'order') {
      setCancellingOrderId(cancellation.order._id);
      try {
        await onCancelOrder(cancellation.order._id);
        setPendingCancellation(null);
      } catch {
        setCancellationError('Order could not be cancelled.');
      } finally {
        setCancellingOrderId(null);
        setConfirmingCancellation(false);
        confirmingCancellationRef.current = false;
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
      setPendingCancellation(null);
    } catch {
      setCancellationError('Selected items could not be cancelled.');
    } finally {
      setCancellingItemOrderId(null);
      setConfirmingCancellation(false);
      confirmingCancellationRef.current = false;
    }
  }

  if (orders.length === 0) {
    return (
      <EmptyState title="No live orders" message="Paid orders with open items will appear here." />
    );
  }

  return (
    <>
      {cancellationError ? (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {cancellationError}
        </p>
      ) : null}

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

      {totalPages > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => {
            const isActive = page === currentPage;

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
                onClick={() => setPageState({ currentPage: page, resetKey: pageResetKey })}
                type="button"
              >
                {page}
              </button>
            );
          })}
        </div>
      ) : null}

      <AlertDialog
        acknowledgeDisabled={confirmingCancellation}
        acknowledgeLabel={confirmingCancellation ? 'Cancelling...' : 'Cancel order'}
        cancelDisabled={confirmingCancellation}
        cancelLabel="Keep order"
        message={
          pendingCancellation?.type === 'order'
            ? `All not-ready items in order #${pendingCancellation.order.orderNumber} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => {
          if (!confirmingCancellation) setPendingCancellation(null);
        }}
        title="Cancel order?"
      />

      <AlertDialog
        acknowledgeDisabled={confirmingCancellation}
        acknowledgeLabel={confirmingCancellation ? 'Cancelling...' : 'Cancel items'}
        cancelDisabled={confirmingCancellation}
        cancelLabel="Keep items"
        message={
          pendingCancellation?.type === 'items'
            ? `${pendingCancellation.itemIds.length} selected item${
                pendingCancellation.itemIds.length === 1 ? '' : 's'
              } in order #${pendingCancellation.order.orderNumber} will be cancelled.`
            : null
        }
        onAcknowledge={() => void confirmCancellation()}
        onCancel={() => {
          if (!confirmingCancellation) setPendingCancellation(null);
        }}
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
          <span className="block text-sm text-text [overflow-wrap:anywhere]">{standSummary}</span>
          <span className="mt-1 block text-xs text-text-muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'} across{' '}
            {standNames.length} stand{standNames.length === 1 ? '' : 's'} /{' '}
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

      {expanded ? (
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
      ) : null}
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
        <p className="text-sm font-medium text-text [overflow-wrap:anywhere]">{item.productName}</p>
        {item.customerComment ? (
          <p className="mt-1 truncate text-xs text-text-muted">{item.customerComment}</p>
        ) : null}
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
