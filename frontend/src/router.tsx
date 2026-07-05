import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import RootLayout from './routes/RootLayout';
import Home from './routes/Home';
import NotFound from './routes/NotFound';
import Imprint from './routes/legal/Imprint';
import PrivacyPolicy from './routes/legal/PrivacyPolicy';

import OrganizerAuth from './routes/auth/OrganizerAuth';
import ForgotPassword from './routes/auth/ForgotPassword';
import ResetPassword from './routes/auth/ResetPassword';
import OrganizerLayout from './routes/organizer/OrganizerLayout';
import OrganizerDashboard, { DashboardError } from './routes/organizer/dashboard/Dashboard';
import { dashboardLoader, dashboardAction } from './routes/organizer/dashboard/data';
import OrganizerEventConfiguration, {
  EventConfigurationError,
} from './routes/organizer/event-configuration/EventConfiguration';
import {
  eventConfigurationLoader,
  eventConfigurationAction,
} from './routes/organizer/event-configuration/data';
import { EventControlCenterError } from './routes/organizer/event-control-center/EventControlCenter';
import EventControlCenterRoute from './routes/organizer/event-control-center/EventControlCenterRoute';
import { eventControlCenterLoader } from './routes/organizer/event-control-center/data';
import OrganizerPayment, { PaymentError } from './routes/organizer/Payment';
import { paymentAction, paymentLoader } from './routes/organizer/Payment.data';
import OrganizerSettings, { SettingsError } from './routes/organizer/settings/Settings';
import { settingsAction, settingsLoader } from './routes/organizer/settings/data';

import AttendeeLayout, { AttendeeLayoutError } from './routes/attendee/AttendeeLayout';
import { attendeeLayoutLoader } from './routes/attendee/data';
import AttendeeProductSelection, {
  ProductSelectionError,
} from './routes/attendee/product-selection/ProductSelection';
import { productSelectionLoader } from './routes/attendee/product-selection/data';
import AttendeeCart from './routes/attendee/cart/Cart';
import { cartLoader } from './routes/attendee/cart/data';
import AttendeeOrderConfirmed from './routes/attendee/checkout/OrderConfirmed';
import AttendeePendingPayment from './routes/attendee/order-history/PendingPayment';
import AttendeeOrderHistory from './routes/attendee/order-history/OrderHistory';
import AttendeeTrackOrder from './routes/attendee/order-history/TrackOrder';
import AttendeeReviewOrder from './routes/attendee/order-history/ReviewOrder';
import { ordersLoader } from './routes/attendee/order-history/data';

import OperatorLayout from './routes/operator/OperatorLayout';
import OperatorLinkEntry from './routes/operator/link-entry/OperatorLinkEntry';
import OperatorPickupDashboard from './routes/operator/pickup-dashboard/PickupDashboard';
import OperatorStandDashboard from './routes/operator/stand-dashboard/OperatorDashboard';
import OperatorStandSelection from './routes/operator/stand-selection/StandSelection';
import CashierLayout from './routes/operator/cashier/CashierLayout';
import CashierHome from './routes/operator/cashier/CashierHome';
import CashierManualOrder from './routes/operator/cashier/CashierManualOrder';
import CashierPayment from './routes/operator/cashier/CashierPayment';
import CashierPaymentDetails from './routes/operator/cashier/CashierPaymentDetails';
import CashierPaymentConfirmed from './routes/operator/cashier/CashierPaymentConfirmed';
import CashierRefund from './routes/operator/cashier/CashierRefund';
import CashierRefundDetails from './routes/operator/cashier/CashierRefundDetails';
import CashierRefundConfirmed from './routes/operator/cashier/CashierRefundConfirmed';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />}>
      <Route index element={<Home />} />

      {/* Auth sits outside the guarded layout to avoid a redirect loop. */}
      <Route path="auth" element={<OrganizerAuth />} />
      <Route path="auth/forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />

      <Route path="imprint" element={<Imprint />} />
      <Route path="privacy" element={<PrivacyPolicy />} />

      <Route path="organizer" element={<OrganizerLayout />}>
        <Route
          index
          element={<OrganizerDashboard />}
          loader={dashboardLoader}
          action={dashboardAction}
          errorElement={<DashboardError />}
        />
        <Route
          path="payment"
          element={<OrganizerPayment />}
          loader={paymentLoader}
          action={paymentAction}
          errorElement={<PaymentError />}
        />
        <Route
          path="settings"
          element={<OrganizerSettings />}
          loader={settingsLoader}
          action={settingsAction}
          errorElement={<SettingsError />}
        />
        <Route
          path="events/:eventId"
          element={<OrganizerEventConfiguration />}
          loader={eventConfigurationLoader}
          action={eventConfigurationAction}
          errorElement={<EventConfigurationError />}
        />
        <Route
          path="events/:eventId/event-control-center/:section"
          element={<EventControlCenterRoute />}
          loader={eventControlCenterLoader}
          errorElement={<EventControlCenterError />}
        />
      </Route>

      <Route
        path="event/:eventId"
        id="attendee-event"
        element={<AttendeeLayout />}
        loader={attendeeLayoutLoader}
        errorElement={<AttendeeLayoutError />}
      >
        <Route
          index
          element={<AttendeeProductSelection />}
          loader={productSelectionLoader}
          errorElement={<ProductSelectionError />}
        />
        <Route path="cart" element={<AttendeeCart />} loader={cartLoader} />
        <Route path="checkout/:orderId/confirmed" element={<AttendeeOrderConfirmed />} />
        <Route path="orders" element={<AttendeeOrderHistory />} loader={ordersLoader} />
        <Route path="orders/:orderId" element={<AttendeeTrackOrder />} />
        <Route path="orders/:orderId/pay" element={<AttendeePendingPayment />} />
        <Route path="orders/:orderId/review" element={<AttendeeReviewOrder />} />
      </Route>

      <Route path="operator" element={<OperatorLayout />} handle={{ title: 'Operator' }}>
        <Route
          path=":eventId/link/:operatorAccessKey"
          element={<OperatorLinkEntry />}
          handle={{ title: 'Operator Console' }}
        />
        <Route
          path=":eventId"
          element={<OperatorStandSelection />}
          handle={{ title: 'Operator Console' }}
        />
        <Route
          path=":eventId/pickup"
          element={<OperatorPickupDashboard />}
          handle={{ title: 'Pick Up' }}
        />
        {/* Static "cashier" out-ranks the dynamic :standId route in v7. */}
        <Route
          path=":eventId/cashier"
          element={<CashierLayout />}
          handle={{ title: 'Cashier Stand' }}
        >
          <Route index element={<CashierHome />} />
          <Route path="order" element={<CashierManualOrder />} handle={{ title: 'Manual Order' }} />
          <Route path="payment" element={<CashierPayment />} handle={{ title: 'Payment' }} />
          <Route
            path="payment/:orderId"
            element={<CashierPaymentDetails />}
            handle={{ title: 'Payment' }}
          />
          <Route
            path="payment/:orderId/confirmed"
            element={<CashierPaymentConfirmed />}
            handle={{ title: 'Payment Confirmed' }}
          />
          <Route path="refund" element={<CashierRefund />} handle={{ title: 'Refund' }} />
          <Route
            path="refund/:orderId"
            element={<CashierRefundDetails />}
            handle={{ title: 'Refund' }}
          />
          <Route
            path="refund/:orderId/confirmed"
            element={<CashierRefundConfirmed />}
            handle={{ title: 'Refund Confirmed' }}
          />
        </Route>
        <Route
          path=":eventId/:standId"
          element={<OperatorStandDashboard />}
          handle={{ title: 'Operator Dashboard' }}
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
