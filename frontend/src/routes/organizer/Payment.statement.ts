// Pure payout math and CSV export for the organizer Payment page. Kept out of
// Payment.tsx so the money calculations stay rendering-independent and testable;
// the UI and the CSV export both build on the same statement so the two can
// never drift.
import { formatMoney } from '@/types/product';
import type { EventPayoutBreakdown, ProductUnitsSold } from '@/types/payout';

// Derived per-event figures for the breakdown table. Sales and payout are kept
// separate on purpose: totalSales is delivered revenue (card + cash, = the
// items-sold table), while netPayout is the card money wired to the bank. They
// are not the same number — cash is already in the organizer's hands — so the
// row never pretends one subtracts down to the other.
export type EventRow = {
  event: EventPayoutBreakdown;
  totalSalesCents: number; // delivered gross (card + cash)
  cashSalesCents: number; // of which paid in cash (already collected)
  cardSalesCents: number; // card portion of sales (captured + still on open tabs)
};

export function toRow(event: EventPayoutBreakdown): EventRow {
  return {
    event,
    totalSalesCents: event.grossSalesCents,
    cashSalesCents: event.cashSalesCents,
    cardSalesCents: event.grossSalesCents - event.cashSalesCents,
  };
}

// Tax rate basis points (1900) -> "19%". Trims any trailing zeros (1950 -> 19.5%).
export function formatTaxRate(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}

// Sum of the per-item lines — the items table and CSV both show this as a
// subtotal so the line items visibly add up to total sales.
export function itemsSubtotal(items: ProductUnitsSold[]): {
  net: number;
  tax: number;
  gross: number;
} {
  return items.reduce(
    (acc, i) => ({
      net: acc.net + i.netRevenueCents,
      tax: acc.tax + i.taxCents,
      gross: acc.gross + i.grossRevenueCents,
    }),
    { net: 0, tax: 0, gross: 0 },
  );
}

// Total sales is the headline; the deductions that bridge it down to the bank
// payout are indented (↳) beneath the bold milestone subtotals. It reads as a
// running calculation top to bottom:
//   Total sales − Cashier payments        = Gross online sales
//   Gross online sales − Uncaptured auths = Captured online sales
//   Captured online sales − fees          = Net payout
// Built once and shared by the UI and the CSV export so the two can never drift.
export type StatementKind = 'line' | 'sub' | 'subtotal' | 'info' | 'total';
export type StatementLine = { label: string; cents: number; kind: StatementKind };

export function eventStatement(row: EventRow): StatementLine[] {
  const { event, totalSalesCents, cashSalesCents, cardSalesCents } = row;
  // Online (card) value still on open/expired auths that never reached the card —
  // the gap between gross online sales and what was captured. Captured is a
  // subset, so this is >= 0.
  const uncapturedCardCents = cardSalesCents - event.capturedCardCents;

  // Tax is reported as a single event total; split it across the cash/card
  // channels in proportion to their gross sales so each "of which tax" sub-line
  // reconciles back to event.taxCents. Exact when all products share one tax
  // rate, a proportional estimate only if rates are mixed across the channels.
  const cashTaxCents =
    totalSalesCents > 0 ? Math.round((event.taxCents * cashSalesCents) / totalSalesCents) : 0;
  const cardTaxCents = event.taxCents - cashTaxCents;

  const lines: StatementLine[] = [
    { label: 'Total sales (incl. tax)', cents: totalSalesCents, kind: 'line' },
  ];
  if (cashSalesCents > 0) {
    lines.push({ label: 'Cashier payments', cents: cashSalesCents, kind: 'sub' });
    if (cashTaxCents > 0) {
      lines.push({ label: 'of which tax (included)', cents: cashTaxCents, kind: 'info' });
    }
  }
  if (cardSalesCents > 0) {
    lines.push({ label: 'Gross online sales', cents: cardSalesCents, kind: 'subtotal' });
    if (cardTaxCents > 0) {
      lines.push({ label: 'of which tax (included)', cents: cardTaxCents, kind: 'info' });
    }
    // Hidden at €0 per the mockup: only surfaces when some auth never captured.
    if (uncapturedCardCents > 0) {
      lines.push({ label: 'Uncaptured / expired auths', cents: uncapturedCardCents, kind: 'sub' });
    }
    lines.push(
      { label: 'Captured online sales', cents: event.capturedCardCents, kind: 'subtotal' },
      { label: 'Online payment processing fees', cents: event.stripeFeeCents, kind: 'sub' },
    );
  }
  lines.push(
    { label: 'Platform fee (20¢/order)', cents: event.platformFeeCents, kind: 'sub' },
    { label: 'Net payout (to your bank)', cents: event.netPayoutCents, kind: 'total' },
  );
  return lines;
}

// Quote a CSV cell only when it contains a delimiter, quote, or newline.
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Build a CSV from a 2-D grid (empty rows render as blank separator lines) and
// trigger a browser download. Shared by both the summary and per-event exports.
function downloadCsv(filename: string, grid: (string | number)[][]) {
  const csv = grid.map((row) => row.map((cell) => csvCell(String(cell))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  );
}

// Export a single event as an invoice-style statement: header, per-item lines
// (net / tax / gross) with a subtotal, the top-to-bottom payout statement, then
// the same cash-flow context the UI shows (incl. cash refunds) so the export is
// fully reconcilable against the cash drawer.
export function downloadEventCsv(row: EventRow) {
  const { event } = row;
  const subtotal = itemsSubtotal(event.unitsSold);
  const grid: (string | number)[][] = [
    ['Event', event.eventName],
    ['Status', event.eventStatus],
    ['Paid orders', event.paidOrderCount],
    [],
    ['Item', 'Units', 'Net', 'Tax', 'Tax rate', 'Gross'],
    ...event.unitsSold.map((item) => [
      item.productName,
      item.unitsSold,
      formatMoney(item.netRevenueCents),
      formatMoney(item.taxCents),
      item.taxRateBp == null ? 'mixed' : formatTaxRate(item.taxRateBp),
      formatMoney(item.grossRevenueCents),
    ]),
    [
      'Subtotal',
      '',
      formatMoney(subtotal.net),
      formatMoney(subtotal.tax),
      '',
      formatMoney(subtotal.gross),
    ],
    [],
    ...eventStatement(row).map((line) => [
      line.label,
      `${line.kind === 'sub' ? '-' : ''}${formatMoney(line.cents)}`,
    ]),
    [],
    // Cash-flow context — mirrors the UI; not part of the payout total above.
    ['Cash-flow context', ''],
    ['On open tabs (ready to charge)', formatMoney(event.onHoldReadyCents)],
    ['Settling on Stripe', formatMoney(event.inTransitCents)],
    ['Cash refunds', `-${formatMoney(event.cashRefundCents)}`],
  ];
  downloadCsv(`lineless-${slug(event.eventName)}-payout-${today()}.csv`, grid);
}
