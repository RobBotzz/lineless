import { z } from "zod";

// Money is always an integer in cents — never float.
const cents = z.number().int().min(0);

// Tax rate as integer basis points (1/10000) — e.g. 1900 for 19%.
// Kept as an integer so tax can be computed in integer cents without
// floating-point error.
const taxRate = z.number().int().min(0).max(10000);

// Stock is a non-negative integer count of units.
const stock = z.number().int().min(0);

export const createProductSchema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().min(1).nullable().default(null),
  priceIncludingTax: cents,
  taxRate: taxRate,
  productImageUrl: z.url().nullable().default(null),
  instantProduct: z.boolean().default(false),
  productStock: stock.default(0),
});

export const updateProductSchema = z.object({
  productName: z.string().min(1).optional(),
  productDescription: z.string().min(1).nullable().optional(),
  priceIncludingTax: cents.optional(),
  taxRate: taxRate.optional(),
  productImageUrl: z.url().nullable().optional(),
  instantProduct: z.boolean().optional(),
  productStock: stock.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
