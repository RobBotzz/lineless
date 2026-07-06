import { Event, generateOperatorAccessKey, type EventDoc } from "./model";
import { EventLogo, type EventLogoDoc } from "./logo.model";
import {
  EventLogoNotFoundError,
  EventNotFoundError,
  EventStateError,
  InvalidImageError,
} from "./errors";
import { assertSessionOwnsEvent } from "./ownership";
import { ensureCashierStand } from "../stands/service";
import { finalizeEventTabs } from "../tabs/service";
import { cancelUnpaidCashOrdersForEvent } from "../orders/service";
import { config } from "../../config/config";
import {
  sniffImageMimeType,
  toNodeBuffer,
  type UploadedImage,
} from "../../shared/imageUpload";
import type { CreateEventInput, UpdateEventInput } from "./types";

type AttendeeEvent = Omit<EventDoc, "operatorAccessKey">;

// Fields safe to return without authentication. Excludes accountId, operatorAccessKey,
// and internal config/billing fields so the endpoint is safe to call without any credential.
export type PublicEventInfo = Pick<
  EventDoc,
  "_id" | "name" | "status" | "plannedDate" | "branding" | "updatedAt"
>;

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

// Public — no auth. Returns only the fields needed for gate pages (coming soon,
// closed, finished). accountId and operatorAccessKey are intentionally excluded.
export async function getPublicEventInfo(
  eventId: string
): Promise<PublicEventInfo> {
  const event = await Event.findOne({ _id: eventId, deletedAt: null }).lean();
  if (!event) throw new EventNotFoundError();
  return {
    _id: event._id,
    name: event.name,
    status: event.status,
    plannedDate: event.plannedDate,
    branding: event.branding,
    updatedAt: event.updatedAt,
  };
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

  // STOPPED and COMPLETED events are readable so guests with existing sessions
  // can still track their orders and receive fulfillments.
  const event = await Event.findOne({
    _id: eventId,
    status: { $in: ["ACTIVE", "STOPPED", "COMPLETED"] },
    deletedAt: null,
  }).lean();
  if (!event) throw new EventNotFoundError();
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

// A COMPLETED event is immutable — its settings, branding, logo, stands and
// products can no longer be changed. Every organizer mutation on the event goes
// through here so the rule lives in one place.
function assertEventModifiable(status: EventDoc["status"]): void {
  if (status === "COMPLETED") {
    throw new EventStateError("A completed event cannot be modified");
  }
}

export async function updateEvent(
  eventId: string,
  accountId: string,
  patch: UpdateEventInput
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  assertEventModifiable(event.status);
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
  if (event.status === "COMPLETED") {
    throw new EventStateError("A completed event cannot be restarted");
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
  return event;
}

export async function completeEvent(
  eventId: string,
  accountId: string
): Promise<EventDoc> {
  const event = await findActiveEvent(eventId, accountId);
  if (event.status !== "STOPPED") {
    throw new EventStateError("Only a stopped event can be completed");
  }

  // Not wrapped in a single Mongo transaction on purpose: finalizeEventTabs makes
  // external Stripe capture/release calls (and runs its own per-tab transactions),
  // which cannot participate in an outer session transaction. Instead each step is
  // idempotent and the status flip below is the last write, so a failure here leaves
  // the event STOPPED and retrying completeEvent safely re-runs the sweeps. Retry is
  // the intended recovery path for a mid-completion failure.
  //
  // Cancel all items on unpaid cash orders so they are not charged.
  await cancelUnpaidCashOrdersForEvent(event._id);
  // Settle open tabs: charge guests for READY/FULFILLED items and release the rest.
  const tabResult = await finalizeEventTabs(event._id);
  if (tabResult.failed > 0 || tabResult.skipped > 0) {
    const parts: string[] = [];
    if (tabResult.failed > 0)
      parts.push(
        `${tabResult.failed} tab${tabResult.failed === 1 ? "" : "s"} could not be charged`
      );
    if (tabResult.skipped > 0)
      parts.push(
        `${tabResult.skipped} tab${tabResult.skipped === 1 ? "" : "s"} still had unsettled items`
      );
    throw new EventStateError(
      `Settlement incomplete (${parts.join("; ")}). Retry completing the event to reattempt.`
    );
  }

  event.status = "COMPLETED";
  event.completedAt = new Date();
  await event.save();
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
  assertEventModifiable(event.status);

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
  assertEventModifiable(event.status);
  await EventLogo.deleteOne({ eventId });
  event.branding.logoUrl = null;
  await event.save();
  return event;
}
