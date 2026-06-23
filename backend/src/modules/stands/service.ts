import { Stand, type StandDoc, type StandType } from "./model";
import {
  CashierStandDisabledError,
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
    requiresPassword: stand.accessPasswordHash != null,
  };
}

async function isCashierEnabled(eventId: string): Promise<boolean> {
  const event = await Event.findById(eventId).lean();
  return event?.cashierEnabled ?? false;
}

// Stands visible on the public surfaces (attendee/operator). A disabled cashier
// is hidden by excluding CASHIER stands from the result.
interface PublicStandFilter {
  eventId: string;
  deletedAt: null;
  standType?: { $ne: StandType };
}

function publicStandFilter(
  eventId: string,
  cashierEnabled: boolean
): PublicStandFilter {
  const filter: PublicStandFilter = { eventId, deletedAt: null };
  if (!cashierEnabled) filter.standType = { $ne: "CASHIER" };
  return filter;
}

// The cashier stand is created lazily and idempotently while the event is being
// configured: enabling the cashier ensures one exists. It is never created via
// the +Stand route, which only makes PRODUCT stands. Disabling does not delete
// it — gating hides it instead — so toggling off and on again during setup keeps
// the same stand and its configuration.
export async function ensureCashierStand(eventId: string): Promise<void> {
  const existing = await Stand.findOne({
    eventId,
    standType: "CASHIER",
    deletedAt: null,
  }).lean();
  if (existing) return;
  await Stand.create({ eventId, standName: "Cashier", standType: "CASHIER" });
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
  const stands = await Stand.find({ eventId, deletedAt: null })
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
  const cashierEnabled = await isCashierEnabled(eventId);
  const stands = await Stand.find(publicStandFilter(eventId, cashierEnabled))
    .sort({ createdAt: 1 })
    .lean();
  return stands.map(strip);
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

export async function listStandsForEventLink(
  eventId: string
): Promise<SafeStand[]> {
  await verifyOperableEvent(eventId);
  const cashierEnabled = await isCashierEnabled(eventId);
  const stands = await Stand.find(publicStandFilter(eventId, cashierEnabled))
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
  stand.deletedAt = new Date();
  await stand.save();
  // A deleted stand can no longer be operated.
  await revokeAllRefreshTokens("OPERATOR", standId);
}
