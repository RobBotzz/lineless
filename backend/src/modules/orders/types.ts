import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1),
  customerComment: z.string().optional(),
});

export const createOrderSchema = z.object({
  standId: z.uuid(),
  tabId: z.uuid().optional(),
  customerEmail: z.email().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
