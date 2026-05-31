import bcrypt from "bcrypt";
import type { HydratedDocument } from "mongoose";
import { Stand, type StandDoc } from "./model";
import { StandNotFoundError } from "./errors";
import type { CreateStandInput, UpdateStandInput } from "./types";
import { config } from "../../config/config";
import { Event } from "../events/model";
import { EventNotFoundError } from "../events/errors";

type SafeStand = Omit<StandDoc, "accessPasswordHash">;

async function verifyEventOwnership(
  eventId: string,
  accountId: string
): Promise<void> {
  const event = await Event.findOne({
    _id: eventId,
    accountId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
}

function strip(stand: HydratedDocument<StandDoc>): SafeStand {
  const obj = stand.toObject() as StandDoc;
  const safe: Partial<StandDoc> = { ...obj };
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
    locationName: input.locationName ?? null,
    xCoordinate: input.xCoordinate ?? null,
    yCoordinate: input.yCoordinate ?? null,
  });
  return strip(stand);
}

export async function listStands(
  eventId: string,
  accountId: string
): Promise<SafeStand[]> {
  await verifyEventOwnership(eventId, accountId);
  const stands = await Stand.find({ eventId, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  return stands.map((s) => {
    const safe: Partial<StandDoc> = { ...s };
    delete safe.accessPasswordHash;
    return safe as SafeStand;
  });
}

export async function getStand(standId: string): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  return strip(stand);
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
  if (patch.locationName !== undefined)
    stand.locationName = patch.locationName ?? null;
  if (patch.xCoordinate !== undefined)
    stand.xCoordinate = patch.xCoordinate ?? null;
  if (patch.yCoordinate !== undefined)
    stand.yCoordinate = patch.yCoordinate ?? null;
  if (patch.accessPassword !== undefined) {
    stand.accessPasswordHash = patch.accessPassword
      ? await bcrypt.hash(patch.accessPassword, config.bcryptRounds)
      : null;
  }
  await stand.save();
  return strip(stand);
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
