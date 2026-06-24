import type { ProductStockAlert } from '@/api/eventControlCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationalCanvas } from '../components/OperationalCanvas';

export function StockAlertsSection({
  productStockAlerts,
}: {
  productStockAlerts: ProductStockAlert[];
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Stock Alerts</CardTitle>
          <p className="mt-2 text-sm text-text-muted">
            Products at or below the configured stock threshold.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {productStockAlerts.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {productStockAlerts.map((alert) => (
              <StockAlertCard alert={alert} key={alert.productId} />
            ))}
          </div>
        ) : (
          <OperationalCanvas
            title="No stock alerts"
            message="Low-stock products will appear here when they reach the configured threshold."
          />
        )}
      </CardContent>
    </Card>
  );
}

function StockAlertCard({ alert }: { alert: ProductStockAlert }) {
  const soldOut = alert.productStock === 0;

  return (
    <article
      className={[
        'rounded-lg border p-4',
        soldOut ? 'border-danger/30 bg-danger/5' : 'border-border bg-background',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text">{alert.productName}</h3>
          <span className="mt-2 inline-flex max-w-full rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
            <span className="truncate">{alert.standName}</span>
          </span>
        </div>
        <span
          className={[
            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
            soldOut
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-accent/30 bg-accent-soft text-accent',
          ].join(' ')}
        >
          {soldOut ? 'Sold out' : 'Low stock'}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Stock</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-text">{alert.productStock}</p>
        </div>
        <p className="text-right text-xs text-text-muted">
          Threshold{' '}
          <span className="font-semibold tabular-nums text-text">{alert.stockAlertThreshold}</span>
        </p>
      </div>
    </article>
  );
}
