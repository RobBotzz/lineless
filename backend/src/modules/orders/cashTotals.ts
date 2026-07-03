import type { OrderDoc, OrderItemDoc } from "./model";

/** Cash figures for an event, all in integer cents. */
export interface CashTotals {
  /** Delivered (READY/FULFILLED, non-cancelled) items on cash orders. */
  cashSalesCents: number;
  /** Sum of all cash refunds. */
  cashRefundCents: number;
  /** cashSalesCents - cashRefundCents. */
  netCashCents: number;
}

// Sales are recognized on delivery, method-agnostic — mirrors the payout rule.
function isDeliveredItem(item: OrderItemDoc): boolean {
  return (
    !item.cancelledAt && (item.readyAt !== null || item.fulfilledAt !== null)
  );
}

// Single source of truth for cash sales/refunds so the cashier net-cash panel
// and the organizer payout report can never drift.
export function computeCashTotals(
  orders: Pick<OrderDoc, "tabId" | "items" | "cashRefunds">[]
): CashTotals {
  const cashSalesCents = orders
    .filter((o) => o.tabId === null)
    .flatMap((o) => o.items.filter(isDeliveredItem))
    .reduce((sum, i) => sum + i.priceIncludingTaxAtPurchase, 0);

  const cashRefundCents = orders.reduce(
    (sum, o) => sum + o.cashRefunds.reduce((s, r) => s + r.amountCents, 0),
    0
  );

  return {
    cashSalesCents,
    cashRefundCents,
    netCashCents: cashSalesCents - cashRefundCents,
  };
}
