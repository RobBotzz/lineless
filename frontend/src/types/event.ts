// Mirrors the backend event module (src/modules/events/model.ts).
// Note: `Event` shadows the DOM's global Event type within importing modules —
// fine here since these modules don't reference the DOM Event.
import type { Location } from './location';

export type EventStatus = 'DRAFT' | 'ACTIVE' | 'STOPPED' | 'COMPLETED';

export interface EventBranding {
  primaryColor: string;
  secondaryColor: string;
  // Accent used as standalone text on the light page (links, prices, headings).
  // null = Auto: derive a legible color from primaryColor at render time.
  accentTextColor: string | null;
  logoUrl: string | null;
}

// Dates are ISO strings over the wire (Mongoose Dates serialize to JSON strings).
export interface Event {
  _id: string;
  accountId: string;
  name: string;
  plannedDate?: string;
  status: EventStatus;
  operatorAccessKey: string;
  ratingsEnabled: boolean;
  cashierEnabled: boolean;
  offlineOrdersEnabled: boolean;
  // Amount held on a guest's card when they open a tab (integer cents).
  baselineHoldCents: number;
  branding: EventBranding;
  location: Location;
  startedAt?: string;
  stoppedAt?: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The logo is served from a stable URL (/api/events/:id/logo) with a long cache
// lifetime, so replacing it would otherwise keep showing the stale image.
// Appending the event's updatedAt as a version busts the cache whenever the
// event (and thus its logo) changes. Returns null when there is no logo.
export function eventLogoSrc(event: Pick<Event, 'branding' | 'updatedAt'>): string | null {
  const { logoUrl } = event.branding;
  if (!logoUrl) return null;
  const version = Date.parse(event.updatedAt);
  if (Number.isNaN(version)) return logoUrl;
  const separator = logoUrl.includes('?') ? '&' : '?';
  return `${logoUrl}${separator}v=${version}`;
}

// Partial patch accepted by PATCH /events/:id (mirrors updateEventSchema).
export interface UpdateEventInput {
  name?: string;
  plannedDate?: string;
  ratingsEnabled?: boolean;
  cashierEnabled?: boolean;
  offlineOrdersEnabled?: boolean;
  // Integer cents; backend enforces a minimum of 100 (€1.00).
  baselineHoldCents?: number;
  branding?: Partial<EventBranding>;
  // Replace semantics: the backend overwrites the whole location object, so
  // always send all three fields (see src/shared/location.ts locationInputSchema).
  location?: Location;
}
