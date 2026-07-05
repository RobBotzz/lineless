import type { EventStatus } from "./model";

export class EventNotFoundError extends Error {
  constructor() {
    super("Event not found");
    this.name = "EventNotFoundError";
  }
}

export class EventNotActiveError extends Error {
  eventStatus: EventStatus;
  constructor(eventStatus: EventStatus) {
    super("Event is not active");
    this.name = "EventNotActiveError";
    this.eventStatus = eventStatus;
  }
}

export class EventStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventStateError";
  }
}

export class EventLogoNotFoundError extends Error {
  constructor() {
    super("Event logo not found");
    this.name = "EventLogoNotFoundError";
  }
}

// Image upload errors are shared across modules that store binary images.
export {
  InvalidImageError,
  ImageTooLargeError,
} from "../../shared/imageUpload";
