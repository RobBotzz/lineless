// Central route paths for navigation. Keep in sync with router.tsx by hand:
// router.tsx is the structural source of truth (the <Route> tree), this module
// is for consumers (Navigate, Link, useNavigate) that need absolute URLs.
export const paths = {
  home: '/',
  login: '/login',
  organizer: {
    root: '/organizer',
    event: (eventId: string) => `/organizer/events/${eventId}`,
  },
  attendee: {
    event: (eventId: string) => `/event/${eventId}`,
  },
  operator: '/operator',
} as const;
