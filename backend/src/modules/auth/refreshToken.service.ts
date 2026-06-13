import { v4 as uuidv4 } from "uuid";
import { RefreshToken, type RefreshSubjectType } from "./refreshToken.model";
import { RefreshTokenInvalidError } from "./errors";
import { generateOpaqueToken, hashOpaqueToken } from "../../lib/opaqueToken";
import { config } from "../../config/config";

// Refresh token lifetime is policy per identity type and lives entirely here —
// callers never pass a TTL.
const REFRESH_TTL_DAYS: Record<RefreshSubjectType, number> = {
  ORGANIZER: config.auth.organizer.refreshTokenTtlDays,
  OPERATOR: config.auth.operator.refreshTokenTtlDays,
};

function refreshTokenExpiry(subjectType: RefreshSubjectType): Date {
  return new Date(
    Date.now() + REFRESH_TTL_DAYS[subjectType] * 24 * 60 * 60 * 1000
  );
}

// Starts a new token family. One family per login — every rotation of this
// token stays in the same family.
export async function issueRefreshToken(
  subjectType: RefreshSubjectType,
  subjectId: string
): Promise<string> {
  const rawToken = generateOpaqueToken();
  await RefreshToken.create({
    subjectType,
    subjectId,
    familyId: uuidv4(),
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: refreshTokenExpiry(subjectType),
  });

  return rawToken;
}

// Rotates a refresh token: the presented token is atomically claimed (marked
// revoked) and replaced by a fresh one in the same family. The rotation is
// scoped to `subjectType` (and optionally a specific `subjectId`) so a token of
// the wrong identity type can never be rotated here — it is rejected without
// being consumed.
export async function rotateRefreshToken(
  rawToken: string,
  subjectType: RefreshSubjectType,
  subjectId?: string
): Promise<{ subjectId: string; refreshToken: string }> {
  const tokenHash = hashOpaqueToken(rawToken);

  // findOneAndUpdate claims the token atomically so two concurrent refresh
  // calls with the same token cannot both succeed. TTL purges expired tokens,
  // but its sweep is not instant — guard expiry here too.
  const tokenDoc = await RefreshToken.findOneAndUpdate(
    {
      tokenHash,
      subjectType,
      ...(subjectId ? { subjectId } : {}),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } }
  ).lean();

  if (!tokenDoc) {
    // Either unknown/expired/wrong-subject, or already rotated. The latter means
    // a rotated token was replayed — assume theft and revoke the entire family.
    const replayed = await RefreshToken.findOne({ tokenHash }).lean();
    if (replayed?.revokedAt) {
      await RefreshToken.deleteMany({ familyId: replayed.familyId });
    }
    throw new RefreshTokenInvalidError();
  }

  const nextRawToken = generateOpaqueToken();
  await RefreshToken.create({
    subjectType: tokenDoc.subjectType,
    subjectId: tokenDoc.subjectId,
    familyId: tokenDoc.familyId,
    tokenHash: hashOpaqueToken(nextRawToken),
    expiresAt: refreshTokenExpiry(tokenDoc.subjectType),
  });

  return { subjectId: tokenDoc.subjectId, refreshToken: nextRawToken };
}

// Logout: drops the whole family the token belongs to. Idempotent — an
// unknown token is treated as already logged out.
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenDoc = await RefreshToken.findOne({
    tokenHash: hashOpaqueToken(rawToken),
  }).lean();
  if (!tokenDoc) return;

  await RefreshToken.deleteMany({ familyId: tokenDoc.familyId });
}

// "Log out everywhere" for one subject — used on organizer password
// change/reset and account deletion, and on operator stand-password change.
export async function revokeAllRefreshTokens(
  subjectType: RefreshSubjectType,
  subjectId: string
): Promise<void> {
  await RefreshToken.deleteMany({ subjectType, subjectId });
}
