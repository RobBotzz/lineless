// Central route paths for navigation. Keep in sync with router.tsx by hand:
// router.tsx is the structural source of truth (the <Route> tree), this module
// is for consumers (Navigate, Link, useNavigate) that need absolute URLs.
export const paths = {
  home: '/',
  auth: '/auth',
  organizer: {
    root: '/organizer',
    payment: '/organizer/payment',
    settings: '/organizer/settings',
    event: (eventId: string) => `/organizer/events/${eventId}`,
  },
  attendee: {
    event: (eventId: string) => `/event/${eventId}`,
  },
  operator: {
    index: '/operator',
    root: (eventId: string) => `/operator/${eventId}`,
    pickupDashboard: (eventId: string) => `/operator/${eventId}/pickup`,
    cashierDashboard: (eventId: string) => `/operator/${eventId}/cashier`,
    stand: (eventId: string, standId: string) => `/operator/${eventId}/${standId}`,
  },
} as const;
