import { Location, type LocationDoc } from "./model";
import { LocationNotFoundError } from "./errors";
import type { CreateLocationInput, UpdateLocationInput } from "./types";

export async function createLocation(
  input: CreateLocationInput
): Promise<LocationDoc> {
  return Location.create({
    locationName: input.locationName,
    xCoordinate: input.xCoordinate,
    yCoordinate: input.yCoordinate,
  });
}

export async function listLocations(): Promise<LocationDoc[]> {
  return Location.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
}

export async function getLocation(locationId: string): Promise<LocationDoc> {
  const location = await Location.findOne({
    _id: locationId,
    deletedAt: null,
  }).lean();
  if (!location) throw new LocationNotFoundError();
  return location;
}

async function findActiveLocation(locationId: string) {
  const location = await Location.findOne({ _id: locationId, deletedAt: null });
  if (!location) throw new LocationNotFoundError();
  return location;
}

export async function updateLocation(
  locationId: string,
  patch: UpdateLocationInput
): Promise<LocationDoc> {
  const location = await findActiveLocation(locationId);
  if (patch.locationName !== undefined)
    location.locationName = patch.locationName;
  if (patch.xCoordinate !== undefined) location.xCoordinate = patch.xCoordinate;
  if (patch.yCoordinate !== undefined) location.yCoordinate = patch.yCoordinate;
  await location.save();
  return location;
}

export async function softDeleteLocation(locationId: string): Promise<void> {
  const location = await findActiveLocation(locationId);
  location.deletedAt = new Date();
  await location.save();
}
