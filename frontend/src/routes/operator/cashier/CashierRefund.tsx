import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';

import { SearchIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { getRefundableOrders } from '../../../api/orders';
import type { Order } from '../../../types/order';
import { computeRefundableTotal } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { formatOrderTime } from './orderFormat';
import { CashierNetCash } from './CashierNetCash';
import type { CashierContext } from './CashierLayout';

export default function CashierRefund() {
  const { eventId, standId } = useOutletContext<CashierContext>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getRefundableOrders(standId)
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch(() => {
        if (active) setOrders([]);
      });
    return () => {
      active = false;
    };
  }, [standId]);

  const trimmed = query.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    if (!orders || !trimmed) return orders;
    return orders.filter((o) => o.orderNumber.toLowerCase().includes(trimmed));
  }, [orders, trimmed]);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    setSearchError(null);

    if (filteredOrders === null) {
      setSearchError('Orders are still loading, please try again.');
      return;
    }

    if (filteredOrders.length === 1) {
      navigate(paths.operator.cashierRefundOrder(eventId, filteredOrders[0]._id));
      return;
    }

    if (filteredOrders.length > 1) return;

    setSearchError(`No refundable order found for "${query.trim()}".`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Cashier Stand</BackButton>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:space-y-0">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-text">Refundable Orders</h2>
              <p className="mt-1 text-sm text-text-muted">
                Cash orders with cancelled items to refund
              </p>
            </div>
            <form onSubmit={handleSearch} className="sm:w-72">
              <label htmlFor="refund-order-id" className="sr-only">
                Search by order number
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="refund-order-id"
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
            {filteredOrders === null ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
            ) : filteredOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                {trimmed
                  ? `No refundable orders matching "${query.trim()}".`
                  : 'No orders awaiting a refund right now.'}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {filteredOrders.map((order) => (
                  <li key={order._id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(paths.operator.cashierRefundOrder(eventId, order._id))
                      }
                      className="flex h-full w-full flex-col rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="block text-base font-semibold text-accent">
                        {order.orderNumber}
                      </span>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
                        <span>{order.pickupCode}</span>
                        <span>{formatOrderTime(order.createdAt)}</span>
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <span className="text-xs text-text-muted">Refundable</span>
                        <span className="text-base font-semibold text-danger">
                          EUR {formatMoney(computeRefundableTotal(order))}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="lg:sticky lg:top-6">
          <CashierNetCash standId={standId} />
        </div>
      </div>
    </div>
  );
}
