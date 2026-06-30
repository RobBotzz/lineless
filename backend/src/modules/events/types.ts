import { z } from "zod";
import { locationInputSchema } from "../../shared/location";
import { DEFAULT_BASELINE_HOLD_CENTS } from "./model";

// Baseline authorization hold in integer cents; must cover at least €1.00.
const baselineHoldCents = z.number().int().min(100);

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
  // null = Auto (derive from primaryColor at render time).
  accentTextColor: hexColor.nullable().default(null),
  logoUrl: z.url().nullable().default(null),
});

const brandingUpdateSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentTextColor: hexColor.nullable().optional(),
  logoUrl: z.url().nullable().optional(),
});

export const createEventSchema = z.object({
  name: z.string().min(1),
  plannedDate: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().default(false),
  cashierEnabled: z.boolean().default(true),
  baselineHoldCents: baselineHoldCents.default(DEFAULT_BASELINE_HOLD_CENTS),
  branding: brandingCreateSchema.prefault({}),
  location: locationInputSchema.optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  plannedDate: z.coerce.date().optional(),
  ratingsEnabled: z.boolean().optional(),
  cashierEnabled: z.boolean().optional(),
  baselineHoldCents: baselineHoldCents.optional(),
  branding: brandingUpdateSchema.optional(),
  location: locationInputSchema.optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
