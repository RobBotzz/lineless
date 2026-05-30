import { z } from "zod";

export const CreateOrderSchema = z.object({
  tabId: z.string().uuid(),
  items: z.array(
    //TODO: Das hier auslagern als eigenes OrderItemSchema
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      customerComment: z.string().optional()
    })
  ).min(1)
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;