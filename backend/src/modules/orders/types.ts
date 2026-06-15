import { z } from "zod";

export const OrderItemInputSchema = z.object({
  productId: z.uuid(),
  customerComment: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  eventId: z.uuid(),
  /** Present for Stripe (tab) orders; absent for cash orders. */
  tabId: z.uuid().optional(),
  customerEmail: z.email().optional(),
  items: z.array(OrderItemInputSchema).min(1),
});

export const ConfirmCashPaymentSchema = z.object({
  /** Intentionally empty — eventId is derived from the order's stored eventId. */
});

export const IssueCashRefundSchema = z.object({
  /** Refund amount in integer cents — must be > 0 and <= order total. */
  amountCents: z.number().int().positive(),
});

export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type ConfirmCashPaymentInput = z.infer<typeof ConfirmCashPaymentSchema>;
export type IssueCashRefundInput = z.infer<typeof IssueCashRefundSchema>;
