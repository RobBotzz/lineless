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
import { formatIban, isValidIban, normalizeIban } from '@/lib/iban';
import { formatMoney } from '@/types/product';
import type { EventPayoutBreakdown, PayoutRecord } from '@/types/payout';
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

// Derived per-event figures shaped for the breakdown table. Sales is revenue
// before refunds so the row reads Sales − Fees − Refunds = Available.
type EventRow = {
  event: EventPayoutBreakdown;
  salesCents: number;
  feesCents: number;
  refundsCents: number;
  availableCents: number;
};

function toRow(event: EventPayoutBreakdown): EventRow {
  const feesCents = event.stripeFeeCents + event.platformFeeCents;
  return {
    event,
    salesCents: event.grossRevenueCents + event.cashRefundCents,
    feesCents,
    refundsCents: event.cashRefundCents,
    availableCents: event.netPayoutCents,
  };
}

// Quote a CSV cell only when it contains a delimiter, quote, or newline.
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Export the per-event breakdown as a spreadsheet-friendly CSV (major units, no
// currency symbol) so organizers can drop it straight into their accounting.
function downloadBreakdownCsv(rows: EventRow[]) {
  const header = [
    'Event',
    'Status',
    'Paid orders',
    'Sales',
    'Card revenue',
    'Cash revenue',
    'Cash refunds',
    'Tax',
    'Card processing fees',
    'Platform fee',
    'Fees total',
    'Available',
  ];
  const lines = rows.map(({ event, salesCents, feesCents, refundsCents, availableCents }) =>
    [
      csvCell(event.eventName),
      event.eventStatus,
      String(event.paidOrderCount),
      formatMoney(salesCents),
      formatMoney(event.cardRevenueCents),
      formatMoney(event.cashRevenueCents),
      formatMoney(refundsCents),
      formatMoney(event.taxCents),
      formatMoney(event.stripeFeeCents),
      formatMoney(event.platformFeeCents),
      formatMoney(feesCents),
      formatMoney(availableCents),
    ].join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lineless-payout-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Payment() {
  const { overview } = useLoaderData() as PaymentLoaderData;
  const rows = overview.events.map(toRow);

  // Delivered-but-uncharged tab value the organizer can release by charging.
  const openTabsReady = overview.events.reduce((sum, e) => sum + e.onHoldReadyCents, 0);

  const bankReady = Boolean(overview.iban && overview.ibanHolderName);
  const openTabEventIds = overview.events
    .filter((e) => e.onHoldReadyCents > 0)
    .map((e) => e.eventId);

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
            openTabEventIds={openTabEventIds}
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
  openTabEventIds,
}: {
  availableNow: number;
  openTabsReady: number;
  inTransit: number;
  bankReady: boolean;
  openTabEventIds: string[];
}) {
  const chargeFetcher = useFetcher<PaymentActionResult>();
  const payoutFetcher = useFetcher<PaymentActionResult>();
  // Which real-money action awaits confirmation, if any.
  const [confirm, setConfirm] = useState<'charge' | 'payout' | null>(null);
  const hasOpenTabs = openTabEventIds.length > 0;
  const canPayout = bankReady && availableNow > 0;

  const charging = chargeFetcher.state !== 'idle';
  const chargeSettled = chargeFetcher.state === 'idle' ? chargeFetcher.data : undefined;
  const chargeResult =
    chargeSettled?.ok && chargeSettled.intent === 'charge-all' ? chargeSettled : null;
  const chargeError = chargeSettled && !chargeSettled.ok ? chargeSettled.error : null;
  const showCharge = useDismissAfter(chargeSettled);

  const payingOut = payoutFetcher.state !== 'idle';
  const payoutSettled = payoutFetcher.state === 'idle' ? payoutFetcher.data : undefined;
  const payoutDone =
    payoutSettled?.ok && payoutSettled.intent === 'request-payout' ? payoutSettled : null;
  const payoutError = payoutSettled && !payoutSettled.ok ? payoutSettled.error : null;
  const showPayout = useDismissAfter(payoutSettled);

  function submit(fetcher: typeof chargeFetcher, payload: PaymentActionBody) {
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function confirmAction() {
    if (confirm === 'charge') {
      submit(chargeFetcher, { intent: 'charge-all', eventIds: openTabEventIds });
    } else if (confirm === 'payout') {
      submit(payoutFetcher, { intent: 'request-payout' });
    }
    setConfirm(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCardIcon className="h-5 w-5 text-accent" />
            Available for Payout
          </CardTitle>
          {bankReady ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <CheckCircleIcon className="h-4 w-4" />
              Ready
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              Setup needed
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
                  ? 'No revenue is available yet. Charge open tabs to make it available.'
                  : 'Add your bank details before requesting a payout.'}
            </p>
          </div>
          <Button
            onClick={() => setConfirm('payout')}
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

        <div className="flex flex-col gap-3 rounded-xl border border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-text">Open tabs</p>
              <p className="text-sm text-text-muted">
                {hasOpenTabs
                  ? `${openTabEventIds.length} event(s) have ready tabs to settle.`
                  : 'All tabs are settled. Open tabs also settle automatically after their hold window.'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setConfirm('charge')}
            disabled={charging || !hasOpenTabs}
            variant="outline"
            className="gap-2"
          >
            {charging ? 'Charging…' : 'Charge open tabs'}
          </Button>
        </div>
        {showCharge && chargeError ? <p className="text-sm text-danger">{chargeError}</p> : null}
        {showCharge && chargeResult ? (
          <p className="text-sm text-success">
            Charged {chargeResult.settled} {chargeResult.settled === 1 ? 'tab' : 'tabs'}
            {chargeResult.skipped > 0 ? `, skipped ${chargeResult.skipped} (items not ready)` : ''}
            {chargeResult.failed > 0 ? `, ${chargeResult.failed} failed` : ''}.
          </p>
        ) : null}
      </CardContent>

      <AlertDialog
        message={
          confirm === 'charge'
            ? `This charges guests' cards across ${openTabEventIds.length} event(s) with ready tabs (${eur(openTabsReady)}). This can't be undone.`
            : confirm === 'payout'
              ? `Transfer ${eur(availableNow)} to your bank account? This records a payout request.`
              : null
        }
        title={confirm === 'charge' ? 'Charge open tabs?' : 'Request payout?'}
        acknowledgeLabel={confirm === 'charge' ? 'Charge now' : 'Request payout'}
        onAcknowledge={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </Card>
  );
}

function EventBreakdownCard({ rows }: { rows: EventRow[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      sales: acc.sales + row.salesCents,
      fees: acc.fees + row.feesCents,
      refunds: acc.refunds + row.refundsCents,
      available: acc.available + row.availableCents,
    }),
    { sales: 0, fees: 0, refunds: 0, available: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <HistoryIcon className="h-5 w-5 text-accent" />
            Event Breakdown
          </CardTitle>
          {rows.length > 0 ? (
            <Button
              onClick={() => downloadBreakdownCsv(rows)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <DownloadIcon className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
        </div>
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
                    Sales
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Fees
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Refunds
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Available
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
                    <td className="px-4 py-3 text-right">{eur(totals.sales)}</td>
                    <td className="px-4 py-3 text-right">{eur(totals.fees)}</td>
                    <td className="px-4 py-3 text-right">{eur(totals.refunds)}</td>
                    <td className="px-4 py-3 text-right">{eur(totals.available)}</td>
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
  const { event } = row;
  const detailId = `event-breakdown-${event.eventId}`;

  return (
    <>
      <tr
        className="cursor-pointer border-t border-border first:border-t-0 hover:bg-surface-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-text">
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
        </td>
        <td className="px-4 py-3 text-right text-text">{eur(row.salesCents)}</td>
        <td className="px-4 py-3 text-right text-text">{eur(row.feesCents)}</td>
        <td className="px-4 py-3 text-right text-text">{eur(row.refundsCents)}</td>
        <td className="px-4 py-3 text-right font-semibold text-text">{eur(row.availableCents)}</td>
      </tr>
      {open ? (
        <tr id={detailId} className="border-t border-border bg-surface-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Detail label="Card revenue" value={eur(event.cardRevenueCents)} />
              <Detail label="Cash revenue" value={eur(event.cashRevenueCents)} />
              <Detail label="Tax (your liability)" value={eur(event.taxCents)} />
              <Detail label="Card processing fees" value={eur(event.stripeFeeCents)} />
              <Detail label="Platform fee (5c/order)" value={eur(event.platformFeeCents)} />
              <Detail label="On hold (not charged)" value={eur(event.onHoldReadyCents)} />
              <Detail label="Settling on Stripe" value={eur(event.inTransitCents)} />
            </div>
            <p className="mt-3 mb-1 text-xs font-medium text-text-muted">Items sold</p>
            {event.unitsSold.length === 0 ? (
              <p className="text-sm text-text-muted">No items sold yet.</p>
            ) : (
              <ul className="space-y-1">
                {event.unitsSold.map((item) => (
                  <li key={item.productId} className="flex justify-between text-sm text-text">
                    <span>
                      {item.productName}
                      <span className="text-text-muted"> × {item.unitsSold}</span>
                    </span>
                    <span>{eur(item.grossRevenueCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
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
