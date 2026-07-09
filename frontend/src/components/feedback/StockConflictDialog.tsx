import { WarningTriangleIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export interface StockConflictItem {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

interface StockConflictDialogProps {
  items: StockConflictItem[] | null;
  onAcknowledge: () => void;
}

export function StockConflictDialog({ items, onAcknowledge }: StockConflictDialogProps) {
  useEscapeKey(onAcknowledge, Boolean(items));

  if (!items) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
    >
      <section
        aria-describedby="stock-conflict-description"
        aria-labelledby="stock-conflict-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]"
        role="alertdialog"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
            <WarningTriangleIcon className="h-6 w-6" />
          </div>
          <div>
            <h2 id="stock-conflict-title" className="text-lg font-semibold text-text">
              We updated your cart
            </h2>
            <p id="stock-conflict-description" className="mt-1 text-sm leading-6 text-text-muted">
              Availability changed during checkout. Your cart now matches the stock that is still
              available.
            </p>
          </div>
        </div>

        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-4 bg-surface-muted/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{item.productName}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.requested} {item.requested === 1 ? 'item' : 'items'} requested
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.available === 0 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                }`}
              >
                {item.available === 0 ? 'Sold out' : `${item.available} available`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-5 text-text-muted">
          Review the updated quantities before trying checkout again.
        </p>
        <Button className="mt-5 w-full" onClick={onAcknowledge} size="lg">
          Review updated cart
        </Button>
      </section>
    </div>
  );
}
