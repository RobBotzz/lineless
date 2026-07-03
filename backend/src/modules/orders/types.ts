import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.uuid(),
  customerComment: z.string().optional(),
});

export const createOrderSchema = z.object({
  eventId: z.uuid(),
  /** Present for Stripe (tab) orders; absent for cash orders. */
  tabId: z.uuid().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const cancelOrderItemsSchema = z.object({
  itemIds: z.array(z.uuid()).min(1),
});

export const confirmCashPaymentSchema = z.object({
  /** Intentionally empty — eventId is derived from the order's stored eventId. */
});

export const issueCashRefundSchema = z.object({
  /** Refund amount in integer cents — must be > 0 and <= order total. */
  amountCents: z.number().int().positive(),
});

export const refundByItemsSchema = z.object({
  /** Cancelled, not-yet-refunded item ids to refund. */
  itemIds: z.array(z.uuid()).min(1),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ConfirmCashPaymentInput = z.infer<typeof confirmCashPaymentSchema>;
export type IssueCashRefundInput = z.infer<typeof issueCashRefundSchema>;
export type RefundByItemsInput = z.infer<typeof refundByItemsSchema>;
