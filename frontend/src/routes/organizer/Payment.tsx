import { useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

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
import { isValidIban } from '@/lib/iban';
import { formatMoney } from '@/types/product';
import type { EventPayoutBreakdown, PayoutRecord } from '@/types/payout';
import type { PaymentActionBody, PaymentActionResult, PaymentLoaderData } from './Payment.data';

function eur(cents: number): string {
  return `€${formatMoney(cents)}`;
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

export default function Payment() {
  const { overview } = useLoaderData() as PaymentLoaderData;
  const rows = overview.events.map(toRow);

  const pending = overview.events.reduce((sum, e) => sum + e.onHoldReadyCents, 0);
  const reserve = overview.events.reduce((sum, e) => sum + e.onHoldAuthorizedCents, 0);

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
            pending={pending}
            reserve={reserve}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-5 py-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text">{value}</p>
    </div>
  );
}

function AvailableForPayoutCard({
  availableNow,
  pending,
  reserve,
  bankReady,
  openTabEventIds,
}: {
  availableNow: number;
  pending: number;
  reserve: number;
  bankReady: boolean;
  openTabEventIds: string[];
}) {
  const chargeFetcher = useFetcher<PaymentActionResult>();
  const payoutFetcher = useFetcher<PaymentActionResult>();
  const hasOpenTabs = openTabEventIds.length > 0;
  const canPayout = bankReady && availableNow > 0;

  const charging = chargeFetcher.state !== 'idle';
  const chargeSettled = chargeFetcher.state === 'idle' ? chargeFetcher.data : undefined;
  const chargeResult =
    chargeSettled?.ok && chargeSettled.intent === 'charge-all' ? chargeSettled : null;
  const chargeError = chargeSettled && !chargeSettled.ok ? chargeSettled.error : null;

  const payingOut = payoutFetcher.state !== 'idle';
  const payoutSettled = payoutFetcher.state === 'idle' ? payoutFetcher.data : undefined;
  const payoutDone =
    payoutSettled?.ok && payoutSettled.intent === 'request-payout' ? payoutSettled : null;
  const payoutError = payoutSettled && !payoutSettled.ok ? payoutSettled.error : null;

  function submit(fetcher: typeof chargeFetcher, payload: PaymentActionBody) {
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function chargeAll() {
    submit(chargeFetcher, { intent: 'charge-all', eventIds: openTabEventIds });
  }

  function payout() {
    submit(payoutFetcher, { intent: 'request-payout' });
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
          <Stat label="Pending" value={eur(pending)} />
          <Stat label="Reserve" value={eur(reserve)} />
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
          <Button onClick={payout} disabled={payingOut || !canPayout} className="gap-2">
            <DownloadIcon className="h-4 w-4" />
            {payingOut ? 'Requesting…' : 'Request payout'}
          </Button>
        </div>
        {payoutError ? <p className="text-sm text-danger">{payoutError}</p> : null}
        {payoutDone ? (
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
            onClick={chargeAll}
            disabled={charging || !hasOpenTabs}
            variant="outline"
            className="gap-2"
          >
            {charging ? 'Charging…' : 'Charge open tabs'}
          </Button>
        </div>
        {chargeError ? <p className="text-sm text-danger">{chargeError}</p> : null}
        {chargeResult ? (
          <p className="text-sm text-success">
            Charged {chargeResult.settled} {chargeResult.settled === 1 ? 'tab' : 'tabs'}
            {chargeResult.skipped > 0 ? `, skipped ${chargeResult.skipped} (items not ready)` : ''}
            {chargeResult.failed > 0 ? `, ${chargeResult.failed} failed` : ''}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventBreakdownCard({ rows }: { rows: EventRow[] }) {
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
                  <th className="px-4 py-3 text-left font-medium">Event</th>
                  <th className="px-4 py-3 text-right font-medium">Sales</th>
                  <th className="px-4 py-3 text-right font-medium">Fees</th>
                  <th className="px-4 py-3 text-right font-medium">Refunds</th>
                  <th className="px-4 py-3 text-right font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <EventBreakdownRow key={row.event.eventId} row={row} />
                ))}
              </tbody>
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

  return (
    <>
      <tr
        className="cursor-pointer border-t border-border first:border-t-0 hover:bg-surface-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-text">
          <span className="flex items-center gap-2">
            <ChevronDownIcon
              className={`h-4 w-4 text-text-muted transition-transform ${open ? '' : '-rotate-90'}`}
            />
            {event.eventName}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-text">{eur(row.salesCents)}</td>
        <td className="px-4 py-3 text-right text-text">{eur(row.feesCents)}</td>
        <td className="px-4 py-3 text-right text-text">{eur(row.refundsCents)}</td>
        <td className="px-4 py-3 text-right font-semibold text-text">{eur(row.availableCents)}</td>
      </tr>
      {open ? (
        <tr className="border-t border-border bg-surface-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Detail label="Card revenue" value={eur(event.cardRevenueCents)} />
              <Detail label="Cash revenue" value={eur(event.cashRevenueCents)} />
              <Detail label="Tax (your liability)" value={eur(event.taxCents)} />
              <Detail label="Card processing fees" value={eur(event.stripeFeeCents)} />
              <Detail label="Platform fee (5c/order)" value={eur(event.platformFeeCents)} />
              <Detail label="On hold (not charged)" value={eur(event.onHoldReadyCents)} />
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
    iban: iban ?? '',
    ibanHolderName: ibanHolderName ?? '',
  });

  const busy = fetcher.state !== 'idle';
  const saved = fetcher.data?.ok === true && fetcher.data.intent === 'save-bank';
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const incomplete = !form.iban.trim() || !form.ibanHolderName.trim();
  // Show the IBAN checksum error only once the field has content.
  const ibanError = form.iban.trim() !== '' && !isValidIban(form.iban) ? 'Invalid IBAN' : null;

  function save() {
    if (ibanError) return;
    const payload: PaymentActionBody = {
      intent: 'save-bank',
      iban: form.iban,
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
          onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
          placeholder="DE89 3704 0044 0532 0130 00"
          helperText="This IBAN is used for all organizer payouts."
          error={ibanError}
        />

        {incomplete ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            Add account holder and IBAN before requesting a payout.
          </div>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-success">Bank details saved.</p> : null}

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
          payouts.slice(0, 6).map((payout) => (
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
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                {payout.status === 'PAID' ? 'Paid' : 'Requested'}
              </span>
            </div>
          ))
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
