import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import Home from './routes/Home';
import NotFound from './routes/NotFound';

import OrganizerAuth from './routes/auth/OrganizerAuth';
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
import AttendeeProductSelection from './routes/attendee/ProductSelection';

import OperatorLayout from './routes/operator/OperatorLayout';
import OperatorCashierDashboard from './routes/operator/CashierDashboard';
import OperatorPickupDashboard from './routes/operator/PickupDashboard';
import OperatorStandDashboard from './routes/operator/Queue';
import OperatorStandSelection from './routes/operator/StandSelection';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/">
      <Route index element={<Home />} />

      {/* Auth sits outside the guarded layout to avoid a redirect loop. */}
      <Route path="auth" element={<OrganizerAuth />} />

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
          path="events/:eventId"
          element={<OrganizerEventConfiguration />}
          loader={eventConfigurationLoader}
          action={eventConfigurationAction}
          errorElement={<EventConfigurationError />}
        />
      </Route>

      <Route path="event/:eventId" element={<AttendeeLayout />}>
        <Route index element={<AttendeeProductSelection />} />
      </Route>

      <Route path="operator" element={<OperatorLayout />}>
        <Route index element={<OperatorStandSelection />} />
        <Route path=":eventId" element={<OperatorStandSelection />} />
        <Route path=":eventId/pickup" element={<OperatorPickupDashboard />} />
        <Route path=":eventId/cashier" element={<OperatorCashierDashboard />} />
        <Route path=":eventId/:standId" element={<OperatorStandDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
