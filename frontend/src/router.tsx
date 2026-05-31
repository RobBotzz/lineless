import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import Home from './routes/Home';
import NotFound from './routes/NotFound';

import OrganizerLayout from './routes/organizer/OrganizerLayout';
import OrganizerLogin from './routes/organizer/Login';
import OrganizerDashboard from './routes/organizer/Dashboard';
import OrganizerEventConfig from './routes/organizer/EventConfig';
import OrganizerPayment from './routes/organizer/Payment';
import OrganizerSettings from './routes/organizer/Settings';

import AttendeeLayout from './routes/attendee/AttendeeLayout';
import AttendeeProductSelection from './routes/attendee/ProductSelection';

import OperatorLayout from './routes/operator/OperatorLayout';
import OperatorDashboard from './routes/operator/Dashboard';
import OperatorStandSelection from './routes/operator/StandSelection';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/">
      <Route index element={<Home />} />

      {/* Login sits outside the guarded layout to avoid a redirect loop. */}
      <Route path="login" element={<OrganizerLogin />} />
      <Route path="organizer" element={<OrganizerLayout />}>
        <Route index element={<OrganizerDashboard />} />
        <Route path="payment" element={<OrganizerPayment />} />
        <Route path="settings" element={<OrganizerSettings />} />
        <Route path="events/:eventId" element={<OrganizerEventConfig />} />
      </Route>

      <Route path="event/:eventId" element={<AttendeeLayout />}>
        <Route index element={<AttendeeProductSelection />} />
      </Route>

      <Route path="operator" element={<OperatorLayout />}>
        <Route index element={<OperatorStandSelection />} />
        <Route path="dashboard" element={<OperatorDashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
