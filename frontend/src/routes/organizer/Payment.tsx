import { useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { formatMoney } from '@/types/product';
import type { EventPayoutBreakdown, EventStatus } from '@/types/payout';
import type { PaymentActionBody, PaymentActionResult, PaymentLoaderData } from './Payment.data';

function eur(cents: number): string {
  return `EUR ${formatMoney(cents)}`;
}

const statusLabel: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  STOPPED: 'Ended',
};

export default function Payment() {
  const { overview } = useLoaderData() as PaymentLoaderData;
  const breakdowns = overview.events;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="text-text-muted text-sm font-medium tracking-wide uppercase">Organizer</p>
          <CardTitle className="text-3xl font-bold">Payout</CardTitle>
          <CardDescription className="max-w-2xl">
            Review the revenue, fees, and net payout for each of your events, close open tabs, and
            set the bank account your payouts are transferred to.
          </CardDescription>
        </CardHeader>
      </Card>

      <BankDetailsCard iban={overview.iban} ibanHolderName={overview.ibanHolderName} />

      {breakdowns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-text-muted">
            You have no events yet. Once guests start ordering, their revenue appears here.
          </CardContent>
        </Card>
      ) : (
        breakdowns.map((event) => <EventPayoutCard key={event.eventId} event={event} />)
      )}
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

  function save() {
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
        <CardTitle>Payout bank account</CardTitle>
        <CardDescription>
          Payouts are transferred manually to this account. (Demo data — no real transfer.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="ibanHolderName"
            label="Account holder name"
            value={form.ibanHolderName}
            onChange={(e) => setForm((p) => ({ ...p, ibanHolderName: e.target.value }))}
            placeholder="Jane Doe"
          />
          <TextField
            id="iban"
            label="IBAN"
            value={form.iban}
            onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
            placeholder="DE89 3704 0044 0532 0130 00"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm text-success">Bank details saved.</p> : null}
        <div>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save bank details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-semibold ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
    </div>
  );
}

function EventPayoutCard({ event }: { event: EventPayoutBreakdown }) {
  const fetcher = useFetcher<PaymentActionResult>();
  const busy = fetcher.state !== 'idle';

  // The fetcher is scoped to this card, so its data is this event's result.
  // Gate on idle so a previous result is hidden while a new charge is running.
  const settled = fetcher.state === 'idle' ? fetcher.data : undefined;
  const result = settled?.ok && settled.intent === 'charge-tabs' ? settled.result : null;
  const error = settled && !settled.ok ? settled.error : null;

  function chargeTabs() {
    const payload: PaymentActionBody = { intent: 'charge-tabs', eventId: event.eventId };
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{event.eventName}</CardTitle>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
            {statusLabel[event.eventStatus]}
          </span>
        </div>
        <CardDescription>
          {event.paidOrderCount} paid {event.paidOrderCount === 1 ? 'order' : 'orders'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Figure label="Gross revenue" value={eur(event.grossRevenueCents)} />
          <Figure label="Net payout" value={eur(event.netPayoutCents)} accent />
          <Figure label="On hold (not charged)" value={eur(event.onHoldReadyCents)} />
          <Figure label="Card revenue" value={eur(event.cardRevenueCents)} />
          <Figure label="Cash revenue" value={eur(event.cashRevenueCents)} />
          <Figure label="Cash refunds" value={eur(event.cashRefundCents)} />
          <Figure label="Card processing fees" value={eur(event.stripeFeeCents)} />
          <Figure label="Platform fee (5c/order)" value={eur(event.platformFeeCents)} />
          <Figure label="Tax (your liability)" value={eur(event.taxCents)} />
        </div>

        {event.onHoldAuthorizedCents > 0 ? (
          <p className="text-xs text-text-muted">
            Authorized on card but not yet captured: {eur(event.onHoldAuthorizedCents)}
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium text-text">Items sold</p>
          {event.unitsSold.length === 0 ? (
            <p className="text-sm text-text-muted">No items sold yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Product</th>
                    <th className="px-4 py-2 text-right font-medium">Units</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {event.unitsSold.map((item) => (
                    <tr key={item.productId} className="border-t border-border">
                      <td className="px-4 py-2 text-text">{item.productName}</td>
                      <td className="px-4 py-2 text-right text-text">{item.unitsSold}</td>
                      <td className="px-4 py-2 text-right text-text">
                        {eur(item.grossRevenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {result ? (
          <p className="text-sm text-success">
            Charged {result.settled} {result.settled === 1 ? 'tab' : 'tabs'}
            {result.skipped > 0 ? `, skipped ${result.skipped} (items not ready)` : ''}
            {result.failed > 0 ? `, ${result.failed} failed` : ''}.
          </p>
        ) : null}

        <div>
          <Button onClick={chargeTabs} disabled={busy}>
            {busy ? 'Charging…' : 'Charge all tabs'}
          </Button>
        </div>
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
        <CardTitle>Payout</CardTitle>
        <CardDescription className="text-danger">{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}
