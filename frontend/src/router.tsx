import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import RootLayout from './routes/RootLayout';
import Home from './routes/Home';
import NotFound from './routes/NotFound';
import Imprint from './routes/legal/Imprint';
import PrivacyPolicy from './routes/legal/PrivacyPolicy';

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
import { EventControlCenterError } from './routes/organizer/event-control-center/EventControlCenter';
import EventControlCenterRoute from './routes/organizer/event-control-center/EventControlCenterRoute';
import { eventControlCenterLoader } from './routes/organizer/event-control-center/data';
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
        <Route path="payment" element={<OrganizerPayment />} />
        <Route
          path="settings"
          element={<OrganizerSettings />}
          loader={settingsLoader}
          action={settingsAction}
          errorElement={<SettingsError />}
        />
        <Route
          path="events/:eventId/event-control-center/:section"
          element={<EventControlCenterRoute />}
          loader={eventControlCenterLoader}
          errorElement={<EventControlCenterError />}
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
        <Route path="orders" element={<AttendeeOrderHistory />} loader={ordersLoader} />
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
