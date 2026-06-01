import { z } from "zod";
import { locationInputSchema } from "../../shared/location";

// Accepts #RGB and #RRGGBB (case-insensitive).
const hexColor = z
  .string()
  .regex(
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "must be a hex color like #RRGGBB"
  );

const brandingCreateSchema = z.object({
  primaryColor: hexColor.default("#020887"),
  secondaryColor: hexColor.default("#FFFFFF"),
  logoUrl: z.url().nullable().default(null),
});

const brandingUpdateSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  logoUrl: z.url().nullable().optional(),
});

export const createEventSchema = z.object({
  name: z.string().min(1),
  plannedDate: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().default(false),
  cashierEnabled: z.boolean().default(true),
  offlineOrdersEnabled: z.boolean().default(true),
  branding: brandingCreateSchema.prefault({}),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  plannedDate: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().optional(),
  cashierEnabled: z.boolean().optional(),
  offlineOrdersEnabled: z.boolean().optional(),
  branding: brandingUpdateSchema.optional(),
});

export const setLocationSchema = locationInputSchema;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type SetLocationInput = z.infer<typeof setLocationSchema>;
