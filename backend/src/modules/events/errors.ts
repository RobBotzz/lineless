export class EventNotFoundError extends Error {
  constructor() {
    super("Event not found");
    this.name = "EventNotFoundError";
  }
}

export class EventStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventStateError";
  }
}
