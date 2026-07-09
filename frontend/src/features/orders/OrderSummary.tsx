import { useState } from 'react';

import { ImageIcon } from '@/components/icons';
import type { OrderItemView } from '@/types/order';
import { formatMoney } from '@/types/product';

import { ItemComments } from './ItemComments';

interface StandGroup {
  standId: string;
  standName: string;
  items: OrderItemView[];
}

function groupByStand(items: OrderItemView[]): StandGroup[] {
  const groups = new Map<string, StandGroup>();
  for (const item of items) {
    const existing = groups.get(item.standId);
    if (existing) existing.items.push(item);
    else
      groups.set(item.standId, { standId: item.standId, standName: item.standName, items: [item] });
  }
  return [...groups.values()];
}

// Product thumbnail served straight from the public image endpoint (the order
// items only carry the productId). Falls back to a placeholder when the product
// has no image (the request 404s → onError).
function ProductThumb({ productId, productName }: { productId: string; productName: string }) {
  const [imageOk, setImageOk] = useState(true);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
      {imageOk ? (
        <img
          src={`/api/products/${productId}/image`}
          alt={productName}
          loading="lazy"
          onError={() => setImageOk(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
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
        {groupByStand(items).map(({ standId, standName, items: standItems }) => (
          <div key={standId} className="border-l-2 border-accent pl-4">
            <p className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{standName}</p>
            <ul className="mt-2 space-y-2">
              {standItems.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-start gap-3 rounded-lg bg-surface-muted p-3"
                >
                  <ProductThumb productId={item.productId} productName={item.productName} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{item.productName}</p>
                    <p className="text-xs text-text-muted">
                      {item.quantity} × EUR {formatMoney(item.unitPrice)}
                    </p>
                    <ItemComments productName={item.productName} comments={item.comments} />
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-accent-contrast">
                    EUR {formatMoney(item.unitPrice * item.quantity)}
                  </p>
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
