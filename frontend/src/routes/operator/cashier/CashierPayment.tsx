import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';

import { AlertDialog } from '../../../components/feedback/AlertDialog';
import { SearchIcon } from '../../../components/icons';
import { BackButton, DeleteIconButton } from '../../../components/shared';
import { ApiError } from '../../../api/client';
import { deleteUnpaidOrder } from '../../../api/orders';
import { useSSE } from '../../../hooks/useSSE';
import type { Order } from '../../../types/order';
import { computeTotal } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { formatOrderTime } from './orderFormat';
import type { CashierContext } from './CashierLayout';

export default function CashierPayment() {
  const { eventId, standId } = useOutletContext<CashierContext>();
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

  const filteredOrders = useMemo(() => {
    if (!visibleOrders || !trimmed) return visibleOrders;
    return visibleOrders.filter((o) => o.orderNumber.toLowerCase().includes(trimmed));
  }, [visibleOrders, trimmed]);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Cashier Stand</BackButton>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Active Unpaid Orders</h2>
            <p className="mt-1 text-sm text-text-muted">
              Click on an order, or search by order number
            </p>
          </div>
          <form onSubmit={handleSearch} className="sm:w-72">
            <label htmlFor="order-id" className="sr-only">
              Search by order number
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="order-id"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchError(null);
                }}
                placeholder="Search order no. (e.g. A001)"
                className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              />
            </div>
          </form>
        </div>

        {searchError ? <p className="mt-3 text-sm text-danger">{searchError}</p> : null}

        <div className="mt-4">
          {eventNotActive ? (
            <p className="py-8 text-center text-sm text-text-muted">
              The event is not active. Unpaid cash orders can no longer be collected.
            </p>
          ) : visibleOrders === null && streamStatus === 'error' ? (
            <p className="py-8 text-center text-sm text-danger">
              Could not load orders. Retrying… check your connection if this persists.
            </p>
          ) : filteredOrders === null ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {trimmed
                ? `No unpaid orders matching "${query.trim()}".`
                : 'No unpaid orders right now.'}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((order) => (
                <li key={order._id} className="relative">
                  <button
                    type="button"
                    onClick={() => navigate(paths.operator.cashierPaymentOrder(eventId, order._id))}
                    className="flex h-full w-full flex-col rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
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
                  </button>
                  <DeleteIconButton
                    label={`Delete order ${order.orderNumber}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(order._id);
                    }}
                    className="absolute right-2 top-2"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
    </div>
  );
}
