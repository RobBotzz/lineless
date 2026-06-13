import { v4 as uuidv4 } from "uuid";
import { model, Schema } from "mongoose";

// The identity a refresh token belongs to. Organizers are keyed by accountId,
// operators by standId — the token machinery itself is identity-agnostic and
// only carries the pair (subjectType, subjectId).
export type RefreshSubjectType = "ORGANIZER" | "OPERATOR";

// Stores only the HASH of a refresh token, never the token itself. Tokens are
// rotated on every use: the used token is kept behind (marked `revokedAt`) so
// a replay of an already-rotated token can be detected as theft. `familyId`
// ties all rotations of one login session together so the whole chain can be
// revoked at once. `expiresAt` carries a TTL index for automatic cleanup.
export interface RefreshTokenDoc {
  _id: string;
  subjectType: RefreshSubjectType;
  subjectId: string;
  familyId: string;
  tokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    _id: { type: String, default: () => uuidv4() },
    subjectType: {
      type: String,
      required: true,
      enum: ["ORGANIZER", "OPERATOR"],
    },
    subjectId: { type: String, required: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    revokedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

// All "log out everywhere" queries filter by the subject, so index the pair.
refreshTokenSchema.index({ subjectType: 1, subjectId: 1 });

export const RefreshToken = model<RefreshTokenDoc>(
  "RefreshToken",
  refreshTokenSchema
);
