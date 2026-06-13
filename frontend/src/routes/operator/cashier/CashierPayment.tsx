import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { SearchIcon } from '../../../components/icons';
import { BackButton } from '../../../components/shared';
import { Button } from '../../../components/ui/button';
import { getOrder, getUnpaidOrders } from '../../../api/orders';
import type { Order } from '../../../types/order';
import { formatMoney } from '../../../types/product';
import { paths } from '../../../paths';
import { formatOrderTime, itemCount } from './orderFormat';

const FALLBACK_EVENT_ID = 'demo-event';

// Cash payment landing: search an order by id or pick one from the unpaid list.
export default function CashierPayment() {
  const { eventId = FALLBACK_EVENT_ID } = useParams();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const id = query.trim();
    if (!id) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const order = await getOrder(id);
      navigate(paths.operator.cashierPaymentOrder(eventId, order.orderId));
    } catch {
      setSearchError(`No order found for "${id}".`);
      setIsSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
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
            placeholder="e.g. LL-001"
            className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
          />
          <Button type="submit" size="lg" disabled={isSearching || query.trim() === ''}>
            <SearchIcon className="mr-2 h-4 w-4" />
            {isSearching ? 'Searching…' : 'Search'}
          </Button>
        </div>
        {searchError ? <p className="mt-3 text-sm text-danger">{searchError}</p> : null}
      </form>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-text">Active Unpaid Orders</h2>
        <p className="mt-1 text-sm text-text-muted">Click on an order to select it for payment</p>

        <div className="mt-4">
          {orders === null ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No unpaid orders right now.</p>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <li key={order.orderId}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(paths.operator.cashierPaymentOrder(eventId, order.orderId))
                    }
                    className="w-full rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-semibold text-accent">{order.orderId}</span>
                      <span className="text-lg font-semibold text-accent">
                        EUR {formatMoney(order.total)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-text-muted">
                      <span>{order.authenticationId}</span>
                      <span>{formatOrderTime(order.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{itemCount(order)} items</p>
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
