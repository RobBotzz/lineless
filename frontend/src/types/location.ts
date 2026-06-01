// Mirrors the backend shared location module (src/shared/location.ts).
// Coordinate convention: xCoordinate = longitude, yCoordinate = latitude (WGS84).
// Leaflet works in [lat, lng], so always convert through the helpers below.
export interface Location {
  locationName: string | null;
  xCoordinate: number | null;
  yCoordinate: number | null;
}

export const emptyLocation: Location = {
  locationName: null,
  xCoordinate: null,
  yCoordinate: null,
};

// True only when both coordinates are present (a name alone is not a point).
export function hasCoordinates(
  loc: Location,
): loc is Location & { xCoordinate: number; yCoordinate: number } {
  return loc.xCoordinate !== null && loc.yCoordinate !== null;
}

// Location -> Leaflet [lat, lng], or null when no point is set.
export function toLatLng(loc: Location): [number, number] | null {
  if (!hasCoordinates(loc)) return null;
  return [loc.yCoordinate, loc.xCoordinate];
}

// Leaflet [lat, lng] -> Location. Empty name is stored as null (backend
// rejects empty strings; locationName is .min(1).nullable()).
export function fromLatLng(lat: number, lng: number, name: string | null = null): Location {
  return {
    locationName: name && name.trim() !== '' ? name : null,
    xCoordinate: lng,
    yCoordinate: lat,
  };
}
