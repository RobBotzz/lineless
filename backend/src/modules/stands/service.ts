import { Stand, type StandDoc } from "./model";
import { OperatorInvalidCredentialsError, StandNotFoundError } from "./errors";
import type {
  CreateStandInput,
  OperatorLoginInput,
  UpdateStandInput,
} from "./types";
import type { SignOptions } from "jsonwebtoken";
import { signJwt } from "../../lib/jwt";
import { comparePassword, hashPassword } from "../../lib/password";
import { config } from "../../config/config";
import {
  assertSessionOwnsEvent,
  verifyActiveEvent,
  verifyEventOwnership,
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
    { expiresIn: config.jwt.operatorExpiresIn as SignOptions["expiresIn"] }
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
  const stands = await Stand.find({ eventId, deletedAt: null })
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
  await verifyActiveEvent(stand.eventId);
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
  }
  await stand.save();
  return strip(stand.toObject());
}

export async function listStandsForEventLink(
  eventId: string
): Promise<SafeStand[]> {
  const stands = await Stand.find({ eventId, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  return stands.map(strip);
}

export interface OperatorLoginResult {
  token: string;
  standId: string;
}

export async function loginOperator(
  input: OperatorLoginInput
): Promise<OperatorLoginResult> {
  const stand = await Stand.findOne({
    _id: input.standId,
    deletedAt: null,
  }).lean();
  if (!stand) {
    throw new OperatorInvalidCredentialsError();
  }

  const event = await Event.findOne({
    _id: stand.eventId,
    status: "ACTIVE",
    deletedAt: null,
  }).lean();
  if (!event) {
    throw new OperatorInvalidCredentialsError();
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
    standId: stand._id,
  };
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
}
