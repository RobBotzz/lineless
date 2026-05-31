import { Location, type LocationDoc } from "./model";
import { EventNotOwnedError } from "./errors";
import { EventNotFoundError } from "../events/errors";
import { Event } from "../events/model";
import type { SetLocationInput } from "./types";

async function requireEvent(eventId: string) {
  const event = await Event.findOne({ _id: eventId, deletedAt: null });
  if (!event) throw new EventNotFoundError();
  return event;
}

export async function getLocationByEvent(
  eventId: string
): Promise<LocationDoc | null> {
  await requireEvent(eventId);
  return Location.findOne({ eventId }).lean();
}

export async function setLocation(
  eventId: string,
  accountId: string,
  input: SetLocationInput
): Promise<LocationDoc> {
  const event = await requireEvent(eventId);
  if (event.accountId !== accountId) throw new EventNotOwnedError();

  const location = await Location.findOneAndUpdate(
    { eventId },
    {
      $set: {
        locationName: input.locationName,
        xCoordinate: input.xCoordinate,
        yCoordinate: input.yCoordinate,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return location;
}
