import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';

import { getRefundableOrders } from '@/api/orders';
import type { Order } from '@/types/order';
import { computeRefundableTotal } from '@/types/order';
import { formatMoney } from '@/types/product';
import { paths } from '@/paths';
import { formatOrderTime } from './orderFormat';
import type { CashierContext } from './CashierLayout';
import { OrderSearchList } from './OrderSearchList';
import { filterOrdersByQuery } from './filterOrdersByQuery';

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

  const filteredOrders = useMemo(() => filterOrdersByQuery(orders, query), [orders, query]);

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

    if (filteredOrders.length > 1) {
      setSearchError(`Multiple orders match "${query.trim()}". Please refine your search.`);
      return;
    }

    setSearchError(`No refundable order found for "${query.trim()}".`);
  }

  return (
    <OrderSearchList<Order>
      backTo={paths.operator.cashier(eventId)}
      backLabel="Cashier Stand"
      title="Refundable Orders"
      subtitle="Cash orders with cancelled items to refund"
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        setSearchError(null);
      }}
      onSubmit={handleSearch}
      searchInputId="refund-order-id"
      searchError={searchError}
      items={filteredOrders}
      gridColsClassName="sm:grid-cols-2 lg:grid-cols-2"
      getItemKey={(order) => order._id}
      onItemClick={(order) => navigate(paths.operator.cashierRefundOrder(eventId, order._id))}
      renderState={
        filteredOrders === null ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            {trimmed
              ? `No refundable orders matching "${query.trim()}".`
              : 'No orders awaiting a refund right now.'}
          </p>
        )
      }
      renderCard={(order) => (
        <>
          <span className="block text-base font-semibold text-accent">{order.orderNumber}</span>
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
        </>
      )}
    />
  );
}
