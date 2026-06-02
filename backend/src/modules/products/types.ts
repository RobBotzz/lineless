import { z } from "zod";

// Money is always an integer in cents — never float.
const cents = z.number().int().min(0);

// Tax rate as a fraction between 0 and 1 (e.g. 0.19 for 19%).
const taxRate = z.number().min(0).max(1);

// Stock is a non-negative integer count of units.
const stock = z.number().int().min(0);

export const createProductSchema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().min(1).nullable().default(null),
  priceExclTax: cents,
  taxRate: taxRate,
  productImageUrl: z.url().nullable().default(null),
  instantProduct: z.boolean().default(false),
  productStock: stock.default(0),
});

export const updateProductSchema = z.object({
  productName: z.string().min(1).optional(),
  productDescription: z.string().min(1).nullable().optional(),
  priceExclTax: cents.optional(),
  taxRate: taxRate.optional(),
  productImageUrl: z.url().nullable().optional(),
  instantProduct: z.boolean().optional(),
  productStock: stock.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
