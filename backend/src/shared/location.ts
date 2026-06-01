import { Schema } from "mongoose";
import { z } from "zod";

export interface Location {
  locationName: string | null;
  xCoordinate: number | null;
  yCoordinate: number | null;
}

export const locationSchema = new Schema<Location>(
  {
    locationName: { type: String, default: null, trim: true },
    xCoordinate: { type: Number, default: null },
    yCoordinate: { type: Number, default: null },
  },
  { _id: false }
);

// Single Zod definition for location input, shared by event and stand.
// Omitted sub-fields default to null (replace semantics, not partial merge).
export const locationInputSchema = z.object({
  locationName: z.string().min(1).nullable().default(null),
  xCoordinate: z.number().nullable().default(null),
  yCoordinate: z.number().nullable().default(null),
});
export type LocationInput = z.infer<typeof locationInputSchema>;
