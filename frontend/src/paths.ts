// Central route paths for navigation. Keep in sync with router.tsx by hand:
// router.tsx is the structural source of truth (the <Route> tree), this module
// is for consumers (Navigate, Link, useNavigate) that need absolute URLs.
export const paths = {
  home: '/',
  auth: '/auth',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/reset-password',
  imprint: '/imprint',
  privacy: '/privacy',
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
    checkoutConfirmed: (eventId: string, orderId: string) =>
      `/event/${eventId}/checkout/${orderId}/confirmed`,
    orders: (eventId: string) => `/event/${eventId}/orders`,
    trackOrder: (eventId: string, orderId: string) => `/event/${eventId}/orders/${orderId}`,
    payOrder: (eventId: string, orderId: string) => `/event/${eventId}/orders/${orderId}/pay`,
    reviewOrder: (eventId: string, orderId: string) => `/event/${eventId}/orders/${orderId}/review`,
  },
  operator: {
    root: (eventId: string) => `/operator/${eventId}`,
    link: (eventId: string, operatorAccessKey: string) =>
      `/operator/${eventId}/link/${operatorAccessKey}`,
    pickupDashboard: (eventId: string) => `/operator/${eventId}/pickup`,
    stand: (eventId: string, standId: string) => `/operator/${eventId}/${standId}`,
    cashier: (eventId: string) => `/operator/${eventId}/cashier`,
    cashierOrder: (eventId: string) => `/operator/${eventId}/cashier/order`,
    cashierPayment: (eventId: string) => `/operator/${eventId}/cashier/payment`,
    cashierPaymentOrder: (eventId: string, orderId: string) =>
      `/operator/${eventId}/cashier/payment/${orderId}`,
    cashierPaymentConfirmed: (eventId: string, orderId: string) =>
      `/operator/${eventId}/cashier/payment/${orderId}/confirmed`,
  },
} as const;
