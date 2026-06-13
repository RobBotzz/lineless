import { CheckCircleIcon, StandIcon } from '@/components/icons';
import type { Order } from '@/types/order';

import { OrderSummary } from './OrderSummary';

interface OrderConfirmationProps {
  order: Order;
  // Banner copy is passed in so each persona words it its own way
  // ("Payment Successful" for the cashier, "Order placed" for the attendee).
  title: string;
  subtitle: string;
  // wide=true: on lg+ screens, products go left and order-meta cards go right.
  // Default stacked layout is used by the attendee confirmation screen.
  wide?: boolean;
}

// Persona-agnostic order-confirmation body: success banner + order number /
// pickup code + the grouped order summary. The page above owns the data fetch
// and the surrounding chrome (back link, etc.).
export function OrderConfirmation({
  order,
  title,
  subtitle,
  wide = false,
}: OrderConfirmationProps) {
  const banner = (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-success/40 bg-success/5 p-8 text-center">
      <CheckCircleIcon className="h-12 w-12 text-success" />
      <h2 className="text-xl font-semibold text-text">{title}</h2>
      <p className="text-sm text-text-muted">{subtitle}</p>
    </div>
  );

  const orderMeta = (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-xs text-text-muted">Order Number</p>
        <p className="mt-1 text-lg font-semibold text-accent">{order.orderId}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-xs text-text-muted">Pickup Code</p>
        <p className="mt-1 text-lg font-semibold text-success">{order.authenticationId}</p>
      </div>
    </div>
  );

  const productSummary = (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2 text-text">
        <StandIcon className="h-5 w-5" />
        <h3 className="font-semibold">Products by Stand</h3>
      </div>
      <div className="mt-4">
        <OrderSummary items={order.items} total={order.total} />
      </div>
    </section>
  );

  if (wide) {
    return (
      <div className="space-y-6">
        {banner}
        <div className="space-y-4 lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-6 lg:space-y-0">
          {productSummary}
          <div className="lg:sticky lg:top-6">{orderMeta}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs text-text-muted">Order Number</p>
          <p className="mt-1 text-lg font-semibold text-accent">{order.orderId}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs text-text-muted">Pickup Code</p>
          <p className="mt-1 text-lg font-semibold text-success">{order.authenticationId}</p>
        </div>
      </div>
      {productSummary}
    </div>
  );
}
