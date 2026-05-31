import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';

import Home from './routes/Home';
import NotFound from './routes/NotFound';

import OrganizerLayout from './routes/organizer/OrganizerLayout';
import OrganizerDashboard from './routes/organizer/Dashboard';
import EventConfig from './routes/organizer/EventConfig';
import OrganizerPayment from './routes/organizer/Payment';
import OrganizerSettings from './routes/organizer/Settings';

import AttendeeLayout from './routes/attendee/AttendeeLayout';
import ProductSelection from './routes/attendee/ProductSelection';

import OperatorLayout from './routes/operator/OperatorLayout';
import StandSelection from './routes/operator/StandSelection';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/">
      <Route index element={<Home />} />

      <Route path="organizer" element={<OrganizerLayout />}>
        <Route index element={<OrganizerDashboard />} />
        <Route path="payment" element={<OrganizerPayment />} />
        <Route path="settings" element={<OrganizerSettings />} />
        <Route path="events/:eventId" element={<EventConfig />} />
      </Route>

      <Route path="event/:eventId" element={<AttendeeLayout />}>
        <Route index element={<ProductSelection />} />
      </Route>

      <Route path="operator" element={<OperatorLayout />}>
        <Route index element={<StandSelection />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
