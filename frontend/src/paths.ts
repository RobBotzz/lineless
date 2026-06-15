// Central route paths for navigation. Keep in sync with router.tsx by hand:
// router.tsx is the structural source of truth (the <Route> tree), this module
// is for consumers (Navigate, Link, useNavigate) that need absolute URLs.
export const paths = {
  home: '/',
  auth: '/auth',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/reset-password',
  organizer: {
    root: '/organizer',
    payment: '/organizer/payment',
    settings: '/organizer/settings',
    event: (eventId: string) => `/organizer/events/${eventId}`,
    eventControlCenterAnalytics: (eventId: string) =>
      `/organizer/events/${eventId}/event-control-center/analytics`,
    eventControlCenterManagement: (eventId: string) =>
      `/organizer/events/${eventId}/event-control-center/management`,
    eventControlCenterSettings: (eventId: string) =>
      `/organizer/events/${eventId}/event-control-center/settings`,
  },
  attendee: {
    event: (eventId: string) => `/event/${eventId}`,
    cart: (eventId: string) => `/event/${eventId}/cart`,
    checkout: (eventId: string) => `/event/${eventId}/checkout`,
    orders: (eventId: string) => `/event/${eventId}/orders`,
  },
  operator: {
    root: (eventId: string) => `/operator/${eventId}`,
    link: (eventId: string, operatorAccessKey: string) =>
      `/operator/${eventId}/link/${operatorAccessKey}`,
    pickupDashboard: (eventId: string) => `/operator/${eventId}/pickup`,
    cashierDashboard: (eventId: string) => `/operator/${eventId}/cashier`,
    stand: (eventId: string, standId: string) => `/operator/${eventId}/${standId}`,
  },
} as const;
