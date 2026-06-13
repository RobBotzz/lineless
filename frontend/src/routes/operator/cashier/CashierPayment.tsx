import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { SearchIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { Button } from '../../../components/ui/button';
import { getUnpaidOrders } from '../../../api/orders';
import type { Order } from '../../../types/order';
import { computeTotal } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { formatOrderTime, itemCount } from './orderFormat';

const FALLBACK_EVENT_ID = 'demo-event';

export default function CashierPayment() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getUnpaidOrders().then((result) => {
      if (active) setOrders(result);
    });
    return () => {
      active = false;
    };
  }, []);

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
      navigate(paths.operator.cashierPaymentOrder(eventId, filteredOrders[0]._id));
      return;
    }

    if (filteredOrders.length > 1) return;

    setSearchError(`No unpaid order found for "${query.trim()}".`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={paths.operator.cashier(eventId)}>Back to Cashier Stand</BackButton>

      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
      >
        <label htmlFor="order-id" className="text-base font-semibold text-text">
          Enter Order Number
        </label>
        <div className="mt-3 flex gap-3">
          <input
            id="order-id"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchError(null);
            }}
            placeholder="e.g. A001"
            className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
          <Button type="submit" size="lg" disabled={!trimmed}>
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
        {searchError ? <p className="mt-3 text-sm text-danger">{searchError}</p> : null}
      </form>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text">Active Unpaid Orders</h2>
        <p className="mt-1 text-sm text-text-muted">Click on an order to select it for payment</p>

        <div className="mt-4">
          {filteredOrders === null ? (
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
                <li key={order._id}>
                  <button
                    type="button"
                    onClick={() => navigate(paths.operator.cashierPaymentOrder(eventId, order._id))}
                    className="h-full w-full rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-base font-semibold text-accent">
                        {order.orderNumber}
                      </span>
                      <span className="shrink-0 text-base font-semibold text-accent">
                        EUR {formatMoney(computeTotal(order))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-text-muted">
                      <span>{order.pickupCode}</span>
                      <span>{formatOrderTime(order.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{itemCount(order)} items</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
