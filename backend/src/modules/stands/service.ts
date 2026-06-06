import bcrypt from "bcrypt";
import { Stand, type StandDoc } from "./model";
import { OperatorInvalidCredentialsError, StandNotFoundError } from "./errors";
import type {
  CreateStandInput,
  OperatorLoginInput,
  UpdateStandInput,
} from "./types";
import { config } from "../../config/config";
import { generateOperatorToken } from "../../middleware/authOperator";
import { verifyActiveEvent, verifyEventOwnership } from "../events/ownership";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";

type SafeStand = Omit<StandDoc, "accessPasswordHash">;

function strip(stand: StandDoc): SafeStand {
  const safe: Partial<StandDoc> = { ...stand };
  delete safe.accessPasswordHash;
  return safe as SafeStand;
}

export async function createStand(
  eventId: string,
  accountId: string,
  input: CreateStandInput
): Promise<SafeStand> {
  await verifyEventOwnership(eventId, accountId);
  const accessPasswordHash = input.accessPassword
    ? await bcrypt.hash(input.accessPassword, config.bcryptRounds)
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
  if (eventId !== sessionEventId) {
    throw new EventNotFoundError();
  }

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
      ? await bcrypt.hash(patch.accessPassword, config.bcryptRounds)
      : null;
  }
  await stand.save();
  return strip(stand.toObject());
}

export interface OperatorLoginResult {
  token: string;
  standId: string;
}

// Authenticates an operator against a stand's accessPasswordHash and issues a
// stand-scoped operator token. The operator identity has no own entity — it is
// the Stand authenticated by password, so this lives in the stands module.
export async function loginOperator(
  input: OperatorLoginInput
): Promise<OperatorLoginResult> {
  const stand = await Stand.findOne({
    _id: input.standId,
    deletedAt: null,
  }).lean();
  if (!stand?.accessPasswordHash) {
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

  const validPassword = await bcrypt.compare(
    input.accessPassword,
    stand.accessPasswordHash
  );
  if (!validPassword) {
    throw new OperatorInvalidCredentialsError();
  }

  return {
    token: generateOperatorToken(stand._id),
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
