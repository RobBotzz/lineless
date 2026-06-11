import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

// Stores only the HASH of a reset token, never the token itself. The raw token
// lives solely in the emailed link. `expiresAt` carries a TTL index so expired
// tokens are removed automatically.
export interface PasswordResetTokenDoc {
  _id: string;
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    accountId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export const PasswordResetToken = model<PasswordResetTokenDoc>(
  "PasswordResetToken",
  passwordResetTokenSchema
);
