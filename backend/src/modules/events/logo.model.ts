import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

// Binary store for event logos. Kept in its own collection (not embedded in
// Event) so listing/reading events never drags the image bytes along. One logo
// per event, enforced by the unique index on eventId; uploading again replaces
// the existing document. Mirrors ProductImage.
export interface EventLogoDoc {
  _id: string;
  eventId: string;
  data: Buffer;
  contentType: string;
  byteSize: number;
  createdAt: Date;
  updatedAt: Date;
}

const eventLogoSchema = new Schema<EventLogoDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    eventId: { type: String, required: true, unique: true, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const EventLogo = model<EventLogoDoc>("EventLogo", eventLogoSchema);
