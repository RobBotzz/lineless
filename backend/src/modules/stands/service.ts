import bcrypt from "bcrypt";
import type { HydratedDocument } from "mongoose";
import { Stand, type StandDoc } from "./model";
import { StandNotFoundError } from "./errors";
import type { CreateStandInput, UpdateStandInput } from "./types";
import { config } from "../../config/config";

type SafeStand = Omit<StandDoc, "accessPasswordHash">;

function strip(stand: HydratedDocument<StandDoc>): SafeStand {
  const obj = stand.toObject() as StandDoc;
  const safe: Partial<StandDoc> = { ...obj };
  delete safe.accessPasswordHash;
  return safe as SafeStand;
}

export async function createStand(
  eventId: string,
  input: CreateStandInput
): Promise<SafeStand> {
  const accessPasswordHash = input.accessPassword
    ? await bcrypt.hash(input.accessPassword, config.bcryptRounds)
    : null;
  const stand = await Stand.create({
    eventId,
    standName: input.standName,
    accessPasswordHash,
    location: input.location,
  });
  return strip(stand);
}

export async function listStands(eventId: string): Promise<SafeStand[]> {
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
  patch: UpdateStandInput
): Promise<SafeStand> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  if (patch.standName !== undefined) stand.standName = patch.standName;
  if (patch.location !== undefined) stand.location = patch.location;
  if (patch.accessPassword !== undefined) {
    stand.accessPasswordHash = patch.accessPassword
      ? await bcrypt.hash(patch.accessPassword, config.bcryptRounds)
      : null;
  }
  await stand.save();
  return strip(stand);
}

export async function softDeleteStand(standId: string): Promise<void> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null });
  if (!stand) throw new StandNotFoundError();
  stand.deletedAt = new Date();
  await stand.save();
}
