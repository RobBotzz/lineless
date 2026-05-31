export class EventNotOwnedError extends Error {
  constructor() {
    super("You do not own this event");
    this.name = "EventNotOwnedError";
  }
}
