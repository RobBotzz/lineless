export class LocationNotFoundError extends Error {
  constructor() {
    super("Location not found");
    this.name = "LocationNotFoundError";
  }
}

export class EventNotOwnedError extends Error {
  constructor() {
    super("You do not own this event");
    this.name = "EventNotOwnedError";
  }
}
