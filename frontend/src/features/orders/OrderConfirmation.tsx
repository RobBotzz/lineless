import { CheckCircleIcon, StandIcon } from '@/components/icons';
import type { Order, OrderItemView } from '@/types/order';

import { OrderSummary } from './OrderSummary';

interface OrderConfirmationProps {
  order: Order;
  // Enriched items — caller joins backend OrderItem[] with product catalog data.
  items: OrderItemView[];
  total: number;
  // Banner copy is passed in so each persona words it its own way.
  title: string;
  subtitle: string;
}

export function OrderConfirmation({ order, items, total, title, subtitle }: OrderConfirmationProps) {
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
        <p className="mt-1 text-lg font-semibold text-accent">{order.orderNumber}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-xs text-text-muted">Pickup Code</p>
        <p className="mt-1 text-lg font-semibold text-success">{order.pickupCode}</p>
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
        <OrderSummary items={items} total={total} />
      </div>
    </section>
  );

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
