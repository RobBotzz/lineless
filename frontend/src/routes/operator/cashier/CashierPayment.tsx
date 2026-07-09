import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';

import { AlertDialog } from '@/components/feedback/AlertDialog';
import { DeleteIconButton } from '@/components/shared';
import { ApiError } from '@/api/client';
import { deleteUnpaidOrder } from '@/api/orders';
import { useSSE } from '@/hooks/useSSE';
import type { Order } from '@/types/order';
import { computeTotal } from '@/types/order';
import { formatMoney } from '@/types/product';
import { paths } from '@/paths';
import { formatOrderTime } from './orderFormat';
import { CashierEventPausedNotice } from './CashierEventPausedNotice';
import type { CashierContext } from './CashierLayout';
import { OrderSearchList } from './OrderSearchList';
import { filterOrdersByQuery } from './filterOrdersByQuery';

export default function CashierPayment() {
  const { eventId, standId, eventStatus } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { status: streamStatus, error: streamError } = useSSE({
    path: '/orders/cashier/stream',
    auth: 'operator',
    standId,
    onMessage: ({ event, data }) => {
      if (event === 'snapshot') setOrders(data as Order[]);
    },
  });

  // The stream requires an ACTIVE event, so it 403s once the event is stopped.
  // Surface that instead of hanging on "Loading orders…" — cash can no longer be
  // collected, so there is no live unpaid list to show.
  const eventNotActive = streamError instanceof ApiError && streamError.status === 403;

  // Derived, not synced via an effect: once the event goes inactive, treat the
  // list as gone rather than keeping whatever was last loaded — otherwise a
  // board that already had orders would keep showing that stale,
  // no-longer-payable list (and let search still navigate to one of them)
  // instead of the "event is not active" notice below.
  const visibleOrders = eventNotActive ? null : orders;

  const trimmed = query.trim().toLowerCase();

  const filteredOrders = useMemo(
    () => filterOrdersByQuery(visibleOrders, query),
    [visibleOrders, query],
  );

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    setSearchError(null);

    if (filteredOrders === null) {
      setSearchError('Orders are still loading, please try again.');
      return;
    }

    if (filteredOrders.length === 1) {
      navigate(paths.operator.cashierPaymentOrder(eventId, filteredOrders[0]._id));
      return;
    }

    if (filteredOrders.length > 1) return;

    setSearchError(`No unpaid order found for "${query.trim()}".`);
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    deleteUnpaidOrder(id, standId)
      .then(() => {
        setOrders((prev) => prev?.filter((o) => o._id !== id) ?? prev);
      })
      .catch(() => {
        setSearchError('Could not delete the order. Please try again.');
      });
  }

  const pendingDeleteOrder = orders?.find((o) => o._id === pendingDeleteId) ?? null;

  // A stopped event can no longer collect cash payments (the order stream 403s).
  // Block the surface up front rather than showing an empty/loading order list.
  if (eventStatus === 'STOPPED') {
    return <CashierEventPausedNotice eventId={eventId} action="Cash payment collection" />;
  }

  return (
    <OrderSearchList<Order>
      backTo={paths.operator.cashier(eventId)}
      backLabel="Cashier Stand"
      title="Active Unpaid Orders"
      subtitle="Click on an order, or search by order number"
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        setSearchError(null);
      }}
      onSubmit={handleSearch}
      searchInputId="order-id"
      searchError={searchError}
      items={filteredOrders}
      gridColsClassName="sm:grid-cols-2 lg:grid-cols-3"
      getItemKey={(order) => order._id}
      onItemClick={(order) => navigate(paths.operator.cashierPaymentOrder(eventId, order._id))}
      renderState={
        eventNotActive ? (
          <p className="py-8 text-center text-sm text-text-muted">
            The event is not active. Unpaid cash orders can no longer be collected.
          </p>
        ) : visibleOrders === null && streamStatus === 'error' ? (
          <p className="py-8 text-center text-sm text-danger">
            Could not load orders. Retrying… check your connection if this persists.
          </p>
        ) : filteredOrders === null ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            {trimmed
              ? `No unpaid orders matching "${query.trim()}".`
              : 'No unpaid orders right now.'}
          </p>
        )
      }
      renderCard={(order) => (
        <>
          <span className="block pr-7 text-base font-semibold text-accent">
            {order.orderNumber}
          </span>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
            <span>{order.pickupCode}</span>
            <span>{formatOrderTime(order.createdAt)}</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span className="text-xs text-text-muted">{order.items.length} items</span>
            <span className="text-base font-semibold text-accent">
              EUR {formatMoney(computeTotal(order))}
            </span>
          </div>
        </>
      )}
      renderItemAction={(order) => (
        <DeleteIconButton
          label={`Delete order ${order.orderNumber}`}
          onClick={(e) => {
            e.stopPropagation();
            setPendingDeleteId(order._id);
          }}
          className="absolute right-2 top-2"
        />
      )}
    >
      <AlertDialog
        message={
          pendingDeleteId
            ? pendingDeleteOrder
              ? `Delete order ${pendingDeleteOrder.orderNumber}? This order will be removed from the cashier view.`
              : 'Delete this unpaid order? It will be removed from the cashier view.'
            : null
        }
        title="Delete Order"
        variant="danger"
        acknowledgeLabel="Delete Order"
        onAcknowledge={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </OrderSearchList>
  );
}
