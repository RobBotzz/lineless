import { Stand, type StandDoc, type StandType } from "./model";
import {
  CashierStandDisabledError,
  CashierStandProtectedError,
  OperatorInvalidCredentialsError,
  StandNotFoundError,
} from "./errors";
import type {
  CreateStandInput,
  OperatorLoginInput,
  UpdateStandInput,
} from "./types";
import { signJwt } from "../../lib/jwt";
import { comparePassword, hashPassword } from "../../lib/password";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from "../auth/refreshToken.service";
import { RefreshTokenInvalidError } from "../auth/errors";
import type { RefreshTokenInput } from "../auth/types";
import { config } from "../../config/config";
import {
  assertSessionOwnsEvent,
  verifyActiveEvent,
  verifyEventOwnership,
  verifyOperableEvent,
} from "../events/ownership";
import { Event } from "../events/model";

// The password hash never leaves the service. We replace it with a
// `requiresPassword` boolean so every stand response carries the one fact a
// client legitimately needs (render a password field or not) without exposing
// the hash itself.
type SafeStand = Omit<StandDoc, "accessPasswordHash"> & {
  requiresPassword: boolean;
};

function issueOperatorToken(standId: string): string {
  return signJwt(
    { tokenType: "OPERATOR", standId },
    { expiresIn: config.auth.operator.accessTokenExpiresIn }
  );
}

function strip(stand: StandDoc): SafeStand {
  const safe: Partial<StandDoc> = { ...stand };
  delete safe.accessPasswordHash;
  return {
    ...(safe as Omit<StandDoc, "accessPasswordHash">),
    standStatus: stand.standStatus ?? "LIVE",
    requiresPassword: stand.accessPasswordHash != null,
  };
}

async function isCashierEnabled(eventId: string): Promise<boolean> {
  const event = await Event.findById(eventId).lean();
  return event?.cashierEnabled ?? false;
}

// Stands that appear in the stand listings. The cashier stand is system-managed
// and intentionally excluded from every getStands surface (organizer, attendee,
// event link); it is reached directly by id, not discovered through a list.
interface ListableStandFilter {
  eventId: string;
  deletedAt: null;
  standType: { $ne: StandType };
  standStatus?: { $ne: "PAUSED" };
}

function listableStandFilter(
  eventId: string,
  options?: { hidePausedProductStands?: boolean }
): ListableStandFilter {
  const filter: ListableStandFilter = {
    eventId,
    deletedAt: null,
    standType: { $ne: "CASHIER" },
  };
  if (options?.hidePausedProductStands) filter.standStatus = { $ne: "PAUSED" };
  return filter;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

// Idempotently guarantees the event's single cashier stand exists. Created by
// the backend only (never via the +Stand route, which makes PRODUCT stands) and
// never deleted, so the partial unique index keeps it at exactly one per event.
// The duplicate-key catch covers a concurrent ensure racing past the lookup.
export async function ensureCashierStand(eventId: string): Promise<void> {
  const existing = await Stand.findOne({
    eventId,
    standType: "CASHIER",
    deletedAt: null,
  }).lean();
  if (existing) return;
  try {
    await Stand.create({ eventId, standName: "Cashier", standType: "CASHIER" });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
}

export async function createStand(
  eventId: string,
  accountId: string,
  input: CreateStandInput
): Promise<SafeStand> {
  await verifyEventOwnership(eventId, accountId);
  const accessPasswordHash = input.accessPassword
    ? await hashPassword(input.accessPassword)
    : null;
  const stand = await Stand.create({
    eventId,
    standName: input.standName,
    accessPasswordHash,
    location: input.location,
  });
  return strip(stand.toObject());
}

export async function listStands(
  eventId: string,
  accountId: string
): Promise<SafeStand[]> {
  await verifyEventOwnership(eventId, accountId);
  const stands = await Stand.find(listableStandFilter(eventId))
    .sort({ createdAt: 1 })
    .lean();
  return stands.map(strip);
}

export async function listStandsForAttendee(
  eventId: string,
  sessionEventId: string
): Promise<SafeStand[]> {
  assertSessionOwnsEvent(eventId, sessionEventId);
  await verifyActiveEvent(eventId);
  const stands = await Stand.find(
    listableStandFilter(eventId, { hidePausedProductStands: true })
  )
    .sort({ createdAt: 1 })
    .lean();
  return stands.map(strip);
}

// Loads the event's single cashier stand, but only when the cashier is enabled.
// The cashier stand is hidden from every stand listing, so this is the dedicated
// "reach it directly" path the listings refer to — used by the operator
// onboarding (event link) to discover the stand it can log into, by the
// organizer, and by attendees (e.g. to show the cashier's location on the
// pending-payment page).
async function findEnabledCashierStand(eventId: string): Promise<SafeStand> {
  if (!(await isCashierEnabled(eventId))) throw new CashierStandDisabledError();
  const stand = await Stand.findOne({
    eventId,
    standType: "CASHIER",
    deletedAt: null,
  }).lean();
  if (!stand) throw new StandNotFoundError();
  return strip(stand);
}

export async function getCashierStandForOrganizer(
  eventId: string,
  accountId: string
): Promise<SafeStand> {
  await verifyEventOwnership(eventId, accountId);
  return findEnabledCashierStand(eventId);
}

export async function getCashierStandForEventLink(
  eventId: string
): Promise<SafeStand> {
  await verifyOperableEvent(eventId);
  return findEnabledCashierStand(eventId);
}

export async function getCashierStandForAttendee(
  eventId: string,
  sessionEventId: string
): Promise<SafeStand> {
  assertSessionOwnsEvent(eventId, sessionEventId);
  await verifyActiveEvent(eventId);
  return findEnabledCashierStand(eventId);
}

async function getStand(standId: string): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  return strip(stand.toObject());
}

export async function getStandForOrganizer(
  standId: string,
  accountId: string
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);
  return strip(stand.toObject());
}

export async function getStandForAttendee(
  standId: string,
  eventId: string
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, eventId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyActiveEvent(eventId);
  return strip(stand.toObject());
}

export async function getStandForOperator(
  standId: string,
  operatorStandId: string
): Promise<SafeStand> {
  if (standId !== operatorStandId) {
    throw new StandNotFoundError();
  }

  const stand = await getStand(standId);
  await verifyOperableEvent(stand.eventId);
  if (
    stand.standType === "CASHIER" &&
    !(await isCashierEnabled(stand.eventId))
  ) {
    throw new CashierStandDisabledError();
  }
  return stand;
}

export async function updateStand(
  standId: string,
  accountId: string,
  patch: UpdateStandInput
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);
  if (patch.standName !== undefined) stand.standName = patch.standName;
  if (patch.location) {
    stand.location.locationName = patch.location.locationName;
    stand.location.xCoordinate = patch.location.xCoordinate;
    stand.location.yCoordinate = patch.location.yCoordinate;
  }
  if (patch.accessPassword !== undefined) {
    stand.accessPasswordHash = patch.accessPassword
      ? await hashPassword(patch.accessPassword)
      : null;
    await revokeAllRefreshTokens("OPERATOR", standId);
  }
  await stand.save();
  return strip(stand.toObject());
}

export async function pauseStand(
  standId: string,
  accountId: string
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);

  stand.standStatus = "PAUSED";
  await stand.save();
  return strip(stand.toObject());
}

export async function resumeStand(
  standId: string,
  accountId: string
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);

  stand.standStatus = "LIVE";
  await stand.save();
  return strip(stand.toObject());
}

export async function listStandsForEventLink(
  eventId: string
): Promise<SafeStand[]> {
  await verifyOperableEvent(eventId);
  const stands = await Stand.find(listableStandFilter(eventId))
    .sort({ createdAt: 1 })
    .lean();
  return stands.map(strip);
}

export interface OperatorLoginResult {
  token: string;
  refreshToken: string;
  standId: string;
}

export async function loginOperator(
  standId: string,
  input: OperatorLoginInput
): Promise<OperatorLoginResult> {
  const stand = await Stand.findOne({
    _id: standId,
    deletedAt: null,
  }).lean();
  if (!stand) {
    throw new OperatorInvalidCredentialsError();
  }

  const event = await Event.findOne({
    _id: stand.eventId,
    deletedAt: null,
  }).lean();
  if (!event) {
    throw new OperatorInvalidCredentialsError();
  }

  // A disabled cashier stand cannot be operated, even with valid credentials.
  if (stand.standType === "CASHIER" && !event.cashierEnabled) {
    throw new CashierStandDisabledError();
  }

  // The event link key is always required
  if (input.operatorAccessKey !== event.operatorAccessKey) {
    throw new OperatorInvalidCredentialsError();
  }

  // Password-protected stands need the password on top of the link key.
  if (stand.accessPasswordHash) {
    if (
      !input.accessPassword ||
      !(await comparePassword(input.accessPassword, stand.accessPasswordHash))
    ) {
      throw new OperatorInvalidCredentialsError();
    }
  }

  return {
    token: issueOperatorToken(stand._id),
    refreshToken: await issueRefreshToken("OPERATOR", stand._id),
    standId: stand._id,
  };
}

// Re-checks that a stand is still operable: it exists, its event still exists,
// and it is not a disabled cashier. The event status is intentionally not
// restricted — operators may work a stand in any lifecycle state, including a
// stopped event. Used on refresh, where the refresh token itself is the proof
// of identity (no password/access key re-entry).
async function assertStandOperable(standId: string): Promise<void> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) {
    throw new RefreshTokenInvalidError();
  }

  const event = await Event.findOne({
    _id: stand.eventId,
    deletedAt: null,
  }).lean();
  if (!event) {
    throw new RefreshTokenInvalidError();
  }

  if (stand.standType === "CASHIER" && !event.cashierEnabled) {
    throw new RefreshTokenInvalidError();
  }
}

// Trades a valid operator refresh token for a fresh access JWT. The token is
// scoped to this stand (a token for another stand is rejected without being
// consumed) and rotated on every use.
export async function refreshOperatorSession(
  standId: string,
  input: RefreshTokenInput
): Promise<OperatorLoginResult> {
  const { subjectId, refreshToken } = await rotateRefreshToken(
    input.refreshToken,
    "OPERATOR",
    standId
  );

  await assertStandOperable(subjectId);

  return {
    token: issueOperatorToken(subjectId),
    refreshToken,
    standId: subjectId,
  };
}

export async function logoutOperator(input: RefreshTokenInput): Promise<void> {
  await revokeRefreshToken(input.refreshToken);
}

export async function softDeleteStand(
  standId: string,
  accountId: string
): Promise<void> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);
  // The cashier stand is system-managed and cannot be deleted by a user.
  if (stand.standType === "CASHIER") {
    throw new CashierStandProtectedError("The cashier stand cannot be deleted");
  }
  stand.deletedAt = new Date();
  await stand.save();
  // A deleted stand can no longer be operated.
  await revokeAllRefreshTokens("OPERATOR", standId);
}
