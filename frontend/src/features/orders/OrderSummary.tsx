import type { OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { ItemComments } from './ItemComments';

function groupByStand(items: OrderItemView[]): [string, OrderItemView[]][] {
  const groups = new Map<string, OrderItemView[]>();
  for (const item of items) {
    const existing = groups.get(item.standName);
    if (existing) existing.push(item);
    else groups.set(item.standName, [item]);
  }
  return [...groups.entries()];
}

interface OrderSummaryProps {
  items: OrderItemView[];
  total: number;
}

// Callers must join backend OrderItem[] with product catalog data before passing items here.
export function OrderSummary({ items, total }: OrderSummaryProps) {
  return (
    <div>
      <div className="space-y-5">
        {groupByStand(items).map(([standName, standItems]) => (
          <div key={standName} className="border-l-2 border-accent pl-4">
            <p className="text-sm font-semibold text-text">{standName}</p>
            <ul className="mt-2 space-y-2">
              {standItems.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{item.productName}</p>
                    <p className="text-xs text-text-muted">Quantity: {item.quantity}</p>
                    <ItemComments productName={item.productName} comments={item.comments} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent-contrast">
                      EUR {formatMoney(item.unitPrice * item.quantity)}
                    </p>
                    <p className="text-xs text-text-muted">
                      EUR {formatMoney(item.unitPrice)} / pc
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-base font-semibold text-text">Total Amount</span>
        <span className="text-lg font-bold text-accent-contrast">EUR {formatMoney(total)}</span>
      </div>
    </div>
  );
}
