import { Event, generateOperatorAccessKey, type EventDoc } from "./model";
import { EventLogo, type EventLogoDoc } from "./logo.model";
import {
  EventLogoNotFoundError,
  EventNotActiveError,
  EventNotFoundError,
  EventStateError,
  InvalidImageError,
} from "./errors";
import { assertSessionOwnsEvent } from "./ownership";
import { ensureCashierStand } from "../stands/service";
import { finalizeEventTabs } from "../tabs/service";
import { config } from "../../config/config";
import {
  sniffImageMimeType,
  toNodeBuffer,
  type UploadedImage,
} from "../../shared/imageUpload";
import type { CreateEventInput, UpdateEventInput } from "./types";

type AttendeeEvent = Omit<EventDoc, "operatorAccessKey">;

function stripOperatorAccessKey(event: EventDoc): AttendeeEvent {
  const safe: Partial<EventDoc> = { ...event };
  delete safe.operatorAccessKey;
  return safe as AttendeeEvent;
}

export async function createEvent(
  accountId: string,
  input: CreateEventInput
): Promise<EventDoc> {
  const event = await Event.create({
    accountId: accountId,
    name: input.name,
    plannedDate: input.plannedDate,
    ratingsEnabled: input.ratingsEnabled,
    cashierEnabled: input.cashierEnabled,
    baselineHoldCents: input.baselineHoldCents,
    branding: input.branding,
    location: input.location,
  });
  // Every event always has exactly one backend-created cashier stand,
  // regardless of whether the cashier is currently enabled.
  await ensureCashierStand(event._id);
  return event;
}

export async function listEvents(accountId: string): Promise<EventDoc[]> {
  return Event.find({ accountId: accountId, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getEventForOrganizer(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await Event.findOne({
    _id: eventId,
    accountId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  return event;
}

export async function getEventForAttendee(
  eventId: string,
  sessionEventId: string
): Promise<AttendeeEvent> {
  assertSessionOwnsEvent(eventId, sessionEventId);

  const event = await Event.findOne({
    _id: eventId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  if (event.status !== "ACTIVE") throw new EventNotActiveError(event.status);
  return stripOperatorAccessKey(event);
}

// Operators reach an event via the event-scoped operator access key. Unlike the
// attendee, they may work the event in any lifecycle state, so no status gate.
export async function getEventForOperatorLink(
  eventId: string,
  linkEventId: string
): Promise<AttendeeEvent> {
  assertSessionOwnsEvent(eventId, linkEventId);

  const event = await Event.findOne({
    _id: eventId,
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
  return stripOperatorAccessKey(event);
}

async function findActiveEvent(eventId: string, accountId: string) {
  const event = await Event.findOne({
    _id: eventId,
    accountId: accountId,
    deletedAt: null,
  });
  if (!event) throw new EventNotFoundError();
  return event;
}

export async function updateEvent(
  eventId: string,
  accountId: string,
  patch: UpdateEventInput
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (patch.name !== undefined) event.name = patch.name;
  if (patch.plannedDate !== undefined) event.plannedDate = patch.plannedDate;
  if (patch.ratingsEnabled !== undefined) {
    event.ratingsEnabled = patch.ratingsEnabled;
  }
  if (patch.cashierEnabled !== undefined) {
    event.cashierEnabled = patch.cashierEnabled;
    if (patch.cashierEnabled) await ensureCashierStand(event._id);
  }
  if (patch.baselineHoldCents !== undefined) {
    event.baselineHoldCents = patch.baselineHoldCents;
  }
  if (patch.branding) {
    if (patch.branding.primaryColor !== undefined) {
      event.branding.primaryColor = patch.branding.primaryColor;
    }
    if (patch.branding.secondaryColor !== undefined) {
      event.branding.secondaryColor = patch.branding.secondaryColor;
    }
    if (patch.branding.accentTextColor !== undefined) {
      event.branding.accentTextColor = patch.branding.accentTextColor;
    }
    // logoUrl is intentionally not patchable here: it is managed server-side by
    // the logo upload/delete endpoints (see setEventLogo / deleteEventLogo).
  }
  if (patch.location) {
    event.location.locationName = patch.location.locationName;
    event.location.xCoordinate = patch.location.xCoordinate;
    event.location.yCoordinate = patch.location.yCoordinate;
  }
  await event.save();
  return event;
}

export async function startEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status === "ACTIVE") {
    throw new EventStateError("Event is already active");
  }
  if (event.status === "STOPPED") {
    throw new EventStateError("A stopped event cannot be restarted");
  }
  event.status = "ACTIVE";
  event.startedAt = new Date();
  await event.save();
  return event;
}

export async function stopEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status !== "ACTIVE") {
    throw new EventStateError("Only an active event can be stopped");
  }
  event.status = "STOPPED";
  event.stoppedAt = new Date();
  await event.save();
  await finalizeEventTabs(event._id);
  return event;
}

export async function rotateOperatorAccessKey(
  eventId: string,
  accountId: string
): Promise<{ operatorAccessKey: string }> {
  const event = await findActiveEvent(eventId, accountId);
  event.operatorAccessKey = generateOperatorAccessKey();
  await event.save();
  return { operatorAccessKey: event.operatorAccessKey };
}

export async function softDeleteEvent(
  eventId: string,
  accountId: string
): Promise<void> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status !== "DRAFT") {
    throw new EventStateError("Only draft events can be deleted");
  }
  event.deletedAt = new Date();
  await event.save();
}

// The URL stored on the event's branding points back at our own serve endpoint,
// so the frontend renders branding.logoUrl directly as an <img> src.
function eventLogoServeUrl(eventId: string): string {
  return `/api/events/${eventId}/logo`;
}

export async function setEventLogo(
  eventId: string,
  accountId: string,
  file: UploadedImage
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);

  const detectedType = sniffImageMimeType(file.buffer);
  if (
    !detectedType ||
    !config.upload.allowedImageMimeTypes.includes(detectedType)
  ) {
    throw new InvalidImageError();
  }

  // One logo per event: upsert replaces any existing logo atomically.
  await EventLogo.findOneAndUpdate(
    { eventId },
    {
      eventId,
      data: file.buffer,
      contentType: detectedType,
      byteSize: file.buffer.length,
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  event.branding.logoUrl = eventLogoServeUrl(eventId);
  // The serve URL is stable, so on a *replace* logoUrl doesn't change — mark it
  // modified so `updatedAt` still bumps. The frontend uses updatedAt as a
  // cache-busting version, so without this a replaced logo keeps showing stale.
  event.markModified("branding.logoUrl");
  await event.save();
  return event;
}

export async function getEventLogo(
  eventId: string
): Promise<Pick<EventLogoDoc, "_id" | "data" | "contentType" | "updatedAt">> {
  const logo = await EventLogo.findOne({ eventId })
    .select("data contentType updatedAt")
    .lean();
  if (!logo) throw new EventLogoNotFoundError();
  return { ...logo, data: toNodeBuffer(logo.data) };
}

export async function deleteEventLogo(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  await EventLogo.deleteOne({ eventId });
  event.branding.logoUrl = null;
  await event.save();
  return event;
}
