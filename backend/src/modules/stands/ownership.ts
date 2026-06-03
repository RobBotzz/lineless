import { Stand } from "./model";
import { StandNotFoundError } from "./errors";
import { verifyEventOwnership } from "../events/ownership";

export async function verifyStandOwnership(
  standId: string,
  accountId: string
): Promise<void> {
  const stand = await Stand.findOne({ _id: standId, deletedAt: null }).lean();
  if (!stand) throw new StandNotFoundError();
  await verifyEventOwnership(stand.eventId, accountId);
}
