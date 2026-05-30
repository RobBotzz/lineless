import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

export type EventStatus = "DRAFT" | "ACTIVE" | "STOPPED";

export interface EventDoc {
  _id: string;
  accountId: string;
  name: string;
  location?: string;
  startsAt?: Date;
  status: EventStatus;
  ratingsEnabled: boolean;
  startedAt?: Date;
  stoppedAt?: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    accountId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    startsAt: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "STOPPED"],
      default: "DRAFT",
    },
    ratingsEnabled: { type: Boolean, default: false },
    startedAt: { type: Date },
    stoppedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Event = model<EventDoc>("Event", eventSchema);
