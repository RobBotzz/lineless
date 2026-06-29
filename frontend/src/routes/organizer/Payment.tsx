import { useEffect, useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

import { AlertDialog } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CreditCardIcon,
  DownloadIcon,
  HistoryIcon,
} from '@/components/icons';
import { formatIban, isValidIban, maskIban, normalizeIban } from '@/lib/iban';
import { formatMoney } from '@/types/product';
import type { EventPayoutBreakdown, PayoutRecord, ProductUnitsSold } from '@/types/payout';
import type { PaymentActionBody, PaymentActionResult, PaymentLoaderData } from './Payment.data';

function eur(cents: number): string {
  return `€${formatMoney(cents)}`;
}

// Keep a settled fetcher banner visible briefly, then dismiss it so a stale
// success/error message can't linger next to freshly revalidated figures. The
// state is only written from the timer callback (never synchronously in the
// effect body), so the react-hooks/set-state-in-effect rule stays happy.
function useDismissAfter(token: unknown, ms = 6000): boolean {
  const [dismissed, setDismissed] = useState<unknown>(null);
  useEffect(() => {
    if (token == null) return;
    const timer = setTimeout(() => setDismissed(token), ms);
    return () => clearTimeout(timer);
  }, [token, ms]);
  return token != null && dismissed !== token;
}

type ChargeResult = Extract<PaymentActionResult, { intent: 'charge-all' }>;

// Charging open tabs is the same action whether it targets every event or one:
// a single fetcher posting `charge-all` with the event ids to settle. Shared by
// the global payout card and the per-event breakdown rows so they behave alike.
function useChargeTabs() {
  const fetcher = useFetcher<PaymentActionResult>();
  const charging = fetcher.state !== 'idle';
  const settled = fetcher.state === 'idle' ? fetcher.data : undefined;
  const result = settled?.ok && settled.intent === 'charge-all' ? settled : null;
  const error = settled && !settled.ok ? settled.error : null;
  const show = useDismissAfter(settled);

  function charge(eventIds: string[]) {
    const payload: PaymentActionBody = { intent: 'charge-all', eventIds };
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  return { charge, charging, show, result, error };
}

function ChargeResultMessage({
  show,
  result,
  error,
}: {
  show: boolean;
  result: ChargeResult | null;
  error: string | null;
}) {
  if (!show) return null;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (result)
    return (
      <p className="text-sm text-success">
        Charged {result.settled} {result.settled === 1 ? 'tab' : 'tabs'}
        {result.skipped > 0 ? `, skipped ${result.skipped} (items not ready)` : ''}
        {result.failed > 0 ? `, ${result.failed} failed` : ''}.
      </p>
    );
  return null;
}

// Derived per-event figures for the breakdown table. Sales and payout are kept
// separate on purpose: totalSales is delivered revenue (card + cash, = the
// items-sold table), while netPayout is the card money wired to the bank. They
// are not the same number — cash is already in the organizer's hands — so the
// row never pretends one subtracts down to the other.
type EventRow = {
  event: EventPayoutBreakdown;
  totalSalesCents: number; // delivered gross (card + cash)
  cashSalesCents: number; // of which paid in cash (already collected)
  cardSalesCents: number; // card portion of sales (captured + still on open tabs)
};

function toRow(event: EventPayoutBreakdown): EventRow {
  return {
    event,
    totalSalesCents: event.grossSalesCents,
    cashSalesCents: event.cashSalesCents,
    cardSalesCents: event.grossSalesCents - event.cashSalesCents,
  };
}

// Tax rate basis points (1900) -> "19%". Trims any trailing zeros (1950 -> 19.5%).
function formatTaxRate(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}

// Sum of the per-item lines — the items table and CSV both show this as a
// subtotal so the line items visibly add up to total sales.
function itemsSubtotal(items: ProductUnitsSold[]): { net: number; tax: number; gross: number } {
  return items.reduce(
    (acc, i) => ({
      net: acc.net + i.netRevenueCents,
      tax: acc.tax + i.taxCents,
      gross: acc.gross + i.grossRevenueCents,
    }),
    { net: 0, tax: 0, gross: 0 },
  );
}

// One continuous, top-to-bottom statement so every step is visibly calculable.
// It bridges from total sales all the way to the bank payout:
//   Total sales − cash − card still on open tabs = Card sales captured
//   Card sales captured − Stripe fees − platform fee = Net payout.
// Built once and shared by the UI and the CSV export so the two can never drift.
type StatementKind = 'add' | 'sub' | 'info' | 'subtotal' | 'total';
type StatementLine = { label: string; cents: number; kind: StatementKind };

function eventStatement(row: EventRow): StatementLine[] {
  const { event, totalSalesCents, cashSalesCents } = row;
  // Delivered card value still on open (unsettled) tabs — exactly the gap
  // between total sales and what has actually hit the card. Card delivered on
  // settled tabs is `capturedCardCents`, so this is always >= 0.
  const uncapturedCardCents = totalSalesCents - cashSalesCents - event.capturedCardCents;

  const lines: StatementLine[] = [
    { label: 'Total sales (incl. tax)', cents: totalSalesCents, kind: 'add' },
  ];
  if (event.taxCents > 0) {
    lines.push({ label: 'of which tax (included)', cents: event.taxCents, kind: 'info' });
  }
  if (cashSalesCents > 0) {
    lines.push({ label: 'Paid in cash (already yours)', cents: cashSalesCents, kind: 'sub' });
  }
  if (uncapturedCardCents > 0) {
    lines.push({
      label: 'On open tabs (not yet captured)',
      cents: uncapturedCardCents,
      kind: 'sub',
    });
  }
  lines.push(
    { label: 'Card sales captured', cents: event.capturedCardCents, kind: 'subtotal' },
    { label: 'Card processing fees', cents: event.stripeFeeCents, kind: 'sub' },
    { label: 'Platform fee (5¢/order)', cents: event.platformFeeCents, kind: 'sub' },
    { label: 'Net payout (to your bank)', cents: event.netPayoutCents, kind: 'total' },
  );
  // Cash never flows through the platform, so it isn't part of the card payout
  // above — but the organizer already holds it. Show it as its own takeaway so
  // the full picture is card-to-bank + cash-in-hand. (Its 5¢/order platform fee
  // was already netted out of the card payout.)
  if (cashSalesCents > 0) {
    lines.push({ label: 'Cash payments (in hand)', cents: cashSalesCents, kind: 'total' });
  }
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
// (net / tax / gross) with a subtotal, then the top-to-bottom payout statement.
function downloadEventCsv(row: EventRow) {
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
  ];
  downloadCsv(`lineless-${slug(event.eventName)}-payout-${today()}.csv`, grid);
}

export default function Payment() {
  const { overview } = useLoaderData() as PaymentLoaderData;
  const rows = overview.events.map(toRow);

  // Delivered-but-uncharged tab value, surfaced as a stat. Charging happens
  // per-event in the breakdown below.
  const openTabsReady = overview.events.reduce((sum, e) => sum + e.onHoldReadyCents, 0);

  const bankReady = Boolean(overview.iban && overview.ibanHolderName);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text">Payment</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage payout details and request available event revenue.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AvailableForPayoutCard
            availableNow={overview.availableCents}
            openTabsReady={openTabsReady}
            inTransit={overview.inTransitCents}
            bankReady={bankReady}
          />
          <EventBreakdownCard rows={rows} />
        </div>

        <div className="space-y-6">
          <BankDetailsCard iban={overview.iban} ibanHolderName={overview.ibanHolderName} />
          <RecentPayoutsCard payouts={overview.payouts} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-5 py-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

function AvailableForPayoutCard({
  availableNow,
  openTabsReady,
  inTransit,
  bankReady,
}: {
  availableNow: number;
  openTabsReady: number;
  inTransit: number;
  bankReady: boolean;
}) {
  const payoutFetcher = useFetcher<PaymentActionResult>();
  const [confirmPayout, setConfirmPayout] = useState(false);
  const canPayout = bankReady && availableNow > 0;

  const payingOut = payoutFetcher.state !== 'idle';
  const payoutSettled = payoutFetcher.state === 'idle' ? payoutFetcher.data : undefined;
  const payoutDone =
    payoutSettled?.ok && payoutSettled.intent === 'request-payout' ? payoutSettled : null;
  const payoutError = payoutSettled && !payoutSettled.ok ? payoutSettled.error : null;
  const showPayout = useDismissAfter(payoutSettled);

  function requestPayout() {
    const payload: PaymentActionBody = { intent: 'request-payout' };
    void payoutFetcher.submit(payload as unknown as Parameters<typeof payoutFetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
    setConfirmPayout(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCardIcon className="h-5 w-5 text-accent" />
            Payout Overview
          </CardTitle>
          {bankReady ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <CheckCircleIcon className="h-4 w-4" />
              Bank ready
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              Bank setup needed
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted">
          Revenue becomes available after card settlements, refunds, and platform fees are cleared.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Available now" value={eur(availableNow)} />
          <Stat
            label="Open tabs"
            value={eur(openTabsReady)}
            hint={openTabsReady > 0 ? 'charge to release' : undefined}
          />
          <Stat
            label="Settling on Stripe"
            value={eur(inTransit)}
            hint={inTransit > 0 ? 'clears automatically' : undefined}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-text">Request a payout</p>
            <p className="text-sm text-text-muted">
              {canPayout
                ? `Transfer ${eur(availableNow)} to your bank account.`
                : bankReady
                  ? 'No revenue is available yet. Wait for settlements.'
                  : 'Add your bank details before requesting a payout.'}
            </p>
          </div>
          <Button
            onClick={() => setConfirmPayout(true)}
            disabled={payingOut || !canPayout}
            className="gap-2"
          >
            <DownloadIcon className="h-4 w-4" />
            {payingOut ? 'Requesting…' : 'Request payout'}
          </Button>
        </div>
        {showPayout && payoutError ? <p className="text-sm text-danger">{payoutError}</p> : null}
        {showPayout && payoutDone ? (
          <p className="text-sm text-success">
            Payout of {eur(payoutDone.amountCents)} requested — it will be transferred to your IBAN.
          </p>
        ) : null}
      </CardContent>

      <AlertDialog
        message={
          confirmPayout
            ? `Transfer ${eur(availableNow)} to your bank account? This records a payout request.`
            : null
        }
        title="Request payout?"
        acknowledgeLabel="Request payout"
        onAcknowledge={requestPayout}
        onCancel={() => setConfirmPayout(false)}
      />
    </Card>
  );
}

function EventBreakdownCard({ rows }: { rows: EventRow[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      sales: acc.sales + row.totalSalesCents,
      cash: acc.cash + row.cashSalesCents,
      card: acc.card + row.cardSalesCents,
    }),
    { sales: 0, cash: 0, card: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <HistoryIcon className="h-5 w-5 text-accent" />
          Event Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            You have no events yet. Once guests start ordering, their revenue appears here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cash
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Card payments
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <EventBreakdownRow key={row.event.eventId} row={row} />
                ))}
              </tbody>
              {rows.length > 1 ? (
                <tfoot className="border-t border-border bg-surface-muted font-semibold text-text">
                  <tr>
                    <td className="px-4 py-3 text-left">Total</td>
                    <td className="px-4 py-3 text-right">{eur(totals.cash)}</td>
                    <td className="px-4 py-3 text-right">{eur(totals.card)}</td>
                    <td className="px-4 py-3 text-right">{eur(totals.sales)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventBreakdownRow({ row }: { row: EventRow }) {
  const [open, setOpen] = useState(false);
  const [confirmCharge, setConfirmCharge] = useState(false);
  const charge = useChargeTabs();
  const { event } = row;
  const detailId = `event-breakdown-${event.eventId}`;
  const hasOpenTabs = event.onHoldReadyCents > 0;

  return (
    <>
      <tr
        className="cursor-pointer border-t border-border first:border-t-0 hover:bg-surface-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-text">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={(e) => {
                // The row already toggles; stop here so we don't toggle twice.
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="flex items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronDownIcon
                className={`h-4 w-4 text-text-muted transition-transform ${open ? '' : '-rotate-90'}`}
              />
              {event.eventName}
            </button>
            {hasOpenTabs ? (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                Open tabs
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-text">
          {row.cashSalesCents > 0 ? eur(row.cashSalesCents) : '—'}
        </td>
        <td className="px-4 py-3 text-right text-text">{eur(row.cardSalesCents)}</td>
        <td className="px-4 py-3 text-right font-semibold text-text">{eur(row.totalSalesCents)}</td>
      </tr>
      {open ? (
        <tr id={detailId} className="border-t border-border bg-surface-muted/30">
          <td colSpan={4} className="space-y-4 px-4 py-3">
            {hasOpenTabs ? (
              <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="text-sm text-text">
                    <span className="font-medium">{eur(event.onHoldReadyCents)}</span> on open tabs
                    is ready to charge.
                  </p>
                </div>
                <Button
                  onClick={() => setConfirmCharge(true)}
                  disabled={charge.charging}
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                >
                  {charge.charging ? 'Charging…' : 'Charge open tabs'}
                </Button>
              </div>
            ) : null}
            <ChargeResultMessage show={charge.show} result={charge.result} error={charge.error} />

            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-text">Items sold</p>
              {event.unitsSold.length > 0 ? (
                <Button
                  onClick={() => downloadEventCsv(row)}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export CSV
                </Button>
              ) : null}
            </div>

            {event.unitsSold.length === 0 ? (
              <p className="text-sm text-text-muted">No items delivered yet.</p>
            ) : (
              <UnitsTable items={event.unitsSold} />
            )}

            {event.pendingUnits.length > 0 ? (
              <div className="space-y-2">
                <p className="text-base font-semibold text-text">
                  Being prepared (ordered, not yet ready)
                </p>
                <UnitsTable items={event.pendingUnits} />
                <p className="text-xs text-text-muted">
                  Not counted as sales until ready — shown so nothing ordered is hidden.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-base font-semibold text-text">Sales &amp; payout</p>
              <dl className="rounded-lg border border-border bg-surface px-4 py-3">
                {eventStatement(row).map((line) => (
                  <StatementRow key={line.label} line={line} />
                ))}
              </dl>
            </div>

            {/* Cash-flow timing context — not part of the sales or payout totals
                above, just where the money currently sits. */}
            <div className="grid gap-2 sm:grid-cols-3">
              <Detail label="On open tabs (ready to charge)" value={eur(event.onHoldReadyCents)} />
              <Detail label="Settling on Stripe" value={eur(event.inTransitCents)} />
              <Detail label="Cash refunds" value={eur(event.cashRefundCents)} />
            </div>

            <AlertDialog
              message={
                confirmCharge
                  ? `This charges guests' cards for "${event.eventName}" (${eur(event.onHoldReadyCents)} on ready tabs). This can't be undone.`
                  : null
              }
              title="Charge open tabs?"
              acknowledgeLabel="Charge now"
              onAcknowledge={() => {
                charge.charge([event.eventId]);
                setConfirmCharge(false);
              }}
              onCancel={() => setConfirmCharge(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StatementRow({ line }: { line: StatementLine }) {
  const isTotal = line.kind === 'total';
  const isSubtotal = line.kind === 'subtotal';
  const isInfo = line.kind === 'info';
  const amount = `${line.kind === 'sub' ? '−' : ''}${eur(line.cents)}`;
  // 'subtotal' is the running result (Card sales captured): a ruled, mid-weight
  // line; 'total' is the final, heavier payout line.
  const rowClass = isTotal
    ? 'mt-1 border-t border-border pt-2 text-base font-semibold text-text'
    : isSubtotal
      ? 'mt-1 border-t border-border/60 pt-2 font-medium text-text'
      : `text-sm ${isInfo ? 'text-text-muted' : 'text-text'}`;
  return (
    <div className={`flex justify-between py-1 ${rowClass}`}>
      <dt className={isInfo ? 'pl-3' : ''}>{line.label}</dt>
      <dd>{amount}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-medium text-text">{value}</p>
    </div>
  );
}

// Per-product units table with a subtotal, shared by the delivered ("Items
// sold") and the not-yet-ready ("Being prepared") breakdowns.
function UnitsTable({ items }: { items: ProductUnitsSold[] }) {
  const subtotal = itemsSubtotal(items);
  return (
    <table className="w-full text-sm">
      <thead className="text-text-muted">
        <tr>
          <th scope="col" className="py-1 text-left font-medium">
            Item
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Units
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Net
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Tax
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Gross
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.productId} className="border-t border-border/60">
            <td className="py-1 pr-2 text-text">{item.productName}</td>
            <td className="py-1 text-right text-text-muted">{item.unitsSold}</td>
            <td className="py-1 text-right text-text">{eur(item.netRevenueCents)}</td>
            <td className="py-1 text-right text-text">
              {eur(item.taxCents)}
              {item.taxRateBp != null ? (
                <span className="text-text-muted"> ({formatTaxRate(item.taxRateBp)})</span>
              ) : null}
            </td>
            <td className="py-1 text-right font-medium text-text">{eur(item.grossRevenueCents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-border font-medium text-text">
        <tr>
          <td className="py-1 pr-2">Subtotal</td>
          <td className="py-1 text-right" />
          <td className="py-1 text-right">{eur(subtotal.net)}</td>
          <td className="py-1 text-right">{eur(subtotal.tax)}</td>
          <td className="py-1 text-right">{eur(subtotal.gross)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function BankDetailsCard({
  iban,
  ibanHolderName,
}: {
  iban: string | null;
  ibanHolderName: string | null;
}) {
  const fetcher = useFetcher<PaymentActionResult>();
  const [form, setForm] = useState({
    iban: formatIban(iban ?? ''),
    ibanHolderName: ibanHolderName ?? '',
  });

  const busy = fetcher.state !== 'idle';
  const settled = fetcher.state === 'idle' ? fetcher.data : undefined;
  const saved = settled?.ok === true && settled.intent === 'save-bank';
  const error = settled && !settled.ok ? settled.error : null;
  const showResult = useDismissAfter(settled);
  const incomplete = !form.iban.trim() || !form.ibanHolderName.trim();
  // Show the IBAN checksum error only once the field has content.
  const ibanError = form.iban.trim() !== '' && !isValidIban(form.iban) ? 'Invalid IBAN' : null;

  function save() {
    if (ibanError) return;
    const payload: PaymentActionBody = {
      intent: 'save-bank',
      iban: normalizeIban(form.iban),
      ibanHolderName: form.ibanHolderName,
    };
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CreditCardIcon className="h-5 w-5 text-accent" />
          Bank Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TextField
          id="ibanHolderName"
          label="Account holder"
          value={form.ibanHolderName}
          onChange={(e) => setForm((p) => ({ ...p, ibanHolderName: e.target.value }))}
          placeholder="Emely"
        />
        <TextField
          id="iban"
          label="IBAN"
          value={form.iban}
          onChange={(e) => setForm((p) => ({ ...p, iban: formatIban(e.target.value) }))}
          placeholder="DE89 3704 0044 0532 0130 00"
          helperText="This IBAN is used for all organizer payouts."
          error={ibanError}
        />

        {incomplete ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Add account holder and IBAN before requesting a payout.
          </div>
        ) : null}
        {showResult && error ? <p className="text-sm text-danger">{error}</p> : null}
        {showResult && saved ? <p className="text-sm text-success">Bank details saved.</p> : null}

        <Button onClick={save} disabled={busy || Boolean(ibanError)} className="w-full">
          {busy ? 'Saving…' : 'Save bank details'}
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentPayoutsCard({ payouts }: { payouts: PayoutRecord[] }) {
  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recent Payouts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {payouts.length === 0 ? (
          <p className="text-sm text-text-muted">No payouts requested yet.</p>
        ) : (
          payouts.slice(0, 6).map((payout) => {
            const paid = payout.status === 'PAID';
            return (
              <div
                key={payout.id}
                className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-text">{eur(payout.amountCents)}</p>
                  <p className="text-xs text-text-muted">
                    {dateFmt.format(new Date(payout.createdAt))}
                  </p>
                  {/* IBAN this transfer went to, snapshotted at payout time. */}
                  <p className="mt-0.5 text-xs text-text-muted" title={payout.ibanHolderName}>
                    {maskIban(payout.iban)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    paid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}
                >
                  {paid ? 'Paid' : 'Requested'}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Could not load payout data.';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
        <p className="text-sm text-danger">{message}</p>
      </CardHeader>
    </Card>
  );
}
