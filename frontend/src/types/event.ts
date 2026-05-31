// Mirrors the backend event module (src/modules/events/model.ts).
// Note: `Event` shadows the DOM's global Event type within importing modules —
// fine here since these modules don't reference the DOM Event.
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED';

export interface EventBranding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

// Dates are ISO strings over the wire (Mongoose Dates serialize to JSON strings).
export interface Event {
  _id: string;
  accountId: string;
  name: string;
  plannedDate?: string;
  status: EventStatus;
  ratingsEnabled: boolean;
  cashierEnabled: boolean;
  offlineOrdersEnabled: boolean;
  branding: EventBranding;
  startedAt?: string;
  stoppedAt?: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Partial patch accepted by PATCH /events/:id (mirrors updateEventSchema).
export interface UpdateEventInput {
  name?: string;
  plannedDate?: string;
  ratingsEnabled?: boolean;
  cashierEnabled?: boolean;
  offlineOrdersEnabled?: boolean;
  branding?: Partial<EventBranding>;
}
