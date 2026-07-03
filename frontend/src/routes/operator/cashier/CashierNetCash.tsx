import { useEffect, useState } from 'react';

import { CASHIER_CASH_SUMMARY_STREAM_PATH, getCashSummary, type CashSummary } from '@/api/orders';
import { formatMoney } from '@/types/product';
import { useSSE, type SseMessage } from '@/hooks/useSSE';

function isCashSummary(value: unknown): value is CashSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CashSummary).netCashCents === 'number'
  );
}

// Live net-cash card for the cashier — seeds from a one-shot fetch, then updates
// over SSE on every order change (payments and refunds both apply). Styled to match
// the sticky summary card in the cash-payment flow.
export function CashierNetCash({ standId }: { standId: string }) {
  const [summary, setSummary] = useState<CashSummary | null>(null);

  useEffect(() => {
    let active = true;
    getCashSummary(standId)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch(() => {
        // Non-fatal: the SSE snapshot fills this in once the stream connects.
      });
    return () => {
      active = false;
    };
  }, [standId]);

  useSSE({
    path: CASHIER_CASH_SUMMARY_STREAM_PATH,
    auth: 'operator',
    standId,
    onMessage: (message: SseMessage) => {
      if (isCashSummary(message.data)) setSummary(message.data);
    },
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text">Net Cash</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-muted">Cash sales</dt>
          <dd className="font-medium text-text">EUR {formatMoney(summary?.cashSalesCents ?? 0)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-muted">Refunds</dt>
          <dd className="font-medium text-danger">
            − EUR {formatMoney(summary?.cashRefundCents ?? 0)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          <dt className="font-semibold text-text">Net</dt>
          <dd className="text-lg font-bold text-accent">
            EUR {formatMoney(summary?.netCashCents ?? 0)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
