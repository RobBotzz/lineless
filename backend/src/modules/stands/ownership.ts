import { Stand } from "./model";
import { StandNotFoundError } from "./errors";
import {
  verifyEventOwnership,
  verifyMutableEventOwnership,
} from "../events/ownership";
import type { EventStatus } from "../events/model";

export async function verifyStandOwnership(
  standId: string,
  accountId: string
): Promise<void> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);
}

// Ownership check for mutations: additionally rejects a product whose event is
// COMPLETED (immutable). Reads keep using verifyStandOwnership.
export async function verifyMutableStandOwnership(
  standId: string,
  accountId: string
): Promise<EventStatus> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) throw new StandNotFoundError();
  return verifyMutableEventOwnership(stand.eventId, accountId);
}
