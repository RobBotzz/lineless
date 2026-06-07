export class AttendeeSessionInvalidError extends Error {
  constructor(message = "Invalid or expired attendee session") {
    super(message);
  }
}

export class SessionEventNotFoundError extends Error {
  constructor() {
    super("Event not found");
  }
}
