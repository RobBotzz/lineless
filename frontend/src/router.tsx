import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import Home from './routes/Home';
import NotFound from './routes/NotFound';

import OrganizerAuth from './routes/auth/OrganizerAuth';
import { OrganizerRequireAuth } from './auth/organizer/OrganizerRequireAuth';
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
import OrganizerPayment from './routes/organizer/Payment';
import OrganizerSettings, { SettingsError } from './routes/organizer/settings/Settings';
import { settingsAction, settingsLoader } from './routes/organizer/settings/data';

import AttendeeLayout from './routes/attendee/AttendeeLayout';
import AttendeeProductSelection, {
  ProductSelectionError,
} from './routes/attendee/product-selection/ProductSelection';
import { productSelectionLoader } from './routes/attendee/product-selection/data';
import AttendeeCart from './routes/attendee/cart/Cart';
import AttendeeOrderConfirmed from './routes/attendee/checkout/OrderConfirmed';
import AttendeeCashPaymentPending from './routes/attendee/checkout/CashPaymentPending';
import AttendeeOrderHistory from './routes/attendee/order-history/OrderHistory';
import AttendeeTrackOrder from './routes/attendee/order-history/TrackOrder';
import AttendeeReviewOrder from './routes/attendee/order-history/ReviewOrder';

import OperatorLayout from './routes/operator/OperatorLayout';
import OperatorLinkEntry from './routes/operator/OperatorLinkEntry';
import OperatorPickupDashboard from './routes/operator/PickupDashboard';
import OperatorStandDashboard from './routes/operator/Queue';
import OperatorStandSelection from './routes/operator/StandSelection';
import CashierLayout from './routes/operator/cashier/CashierLayout';
import CashierHome from './routes/operator/cashier/CashierHome';
import CashierManualOrder from './routes/operator/cashier/CashierManualOrder';
import CashierPayment from './routes/operator/cashier/CashierPayment';
import CashierPaymentDetails from './routes/operator/cashier/CashierPaymentDetails';
import CashierPaymentConfirmed from './routes/operator/cashier/CashierPaymentConfirmed';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/">
      <Route index element={<Home />} />

      {/* Auth sits outside the guarded layout to avoid a redirect loop. */}
      <Route path="auth" element={<OrganizerAuth />} />
      <Route path="auth/forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />

      <Route path="organizer" element={<OrganizerLayout />}>
        <Route
          index
          element={<OrganizerDashboard />}
          loader={dashboardLoader}
          action={dashboardAction}
          errorElement={<DashboardError />}
        />
        <Route path="payment" element={<OrganizerPayment />} />
        <Route
          path="settings"
          element={<OrganizerSettings />}
          loader={settingsLoader}
          action={settingsAction}
          errorElement={<SettingsError />}
        />
      </Route>

      <Route
        path="organizer/events/:eventId"
        element={
          <OrganizerRequireAuth>
            <OrganizerEventConfiguration />
          </OrganizerRequireAuth>
        }
        loader={eventConfigurationLoader}
        action={eventConfigurationAction}
        errorElement={<EventConfigurationError />}
      />

      <Route path="event/:eventId" element={<AttendeeLayout />}>
        <Route
          index
          element={<AttendeeProductSelection />}
          loader={productSelectionLoader}
          errorElement={<ProductSelectionError />}
        />
        <Route path="cart" element={<AttendeeCart />} />
        <Route path="checkout/:orderId/confirmed" element={<AttendeeOrderConfirmed />} />
        <Route path="checkout/:orderId/pending" element={<AttendeeCashPaymentPending />} />
        <Route path="orders" element={<AttendeeOrderHistory />} />
        <Route path="orders/:orderId" element={<AttendeeTrackOrder />} />
        <Route path="orders/:orderId/review" element={<AttendeeReviewOrder />} />
      </Route>

      <Route path="operator" element={<OperatorLayout />} handle={{ title: 'Operator' }}>
        <Route
          path=":eventId/link/:operatorAccessKey"
          element={<OperatorLinkEntry />}
          handle={{ title: 'Stand Selection' }}
        />
        <Route
          path=":eventId"
          element={<OperatorStandSelection />}
          handle={{ title: 'Stand Selection' }}
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
