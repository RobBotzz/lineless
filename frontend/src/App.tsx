import { RouterProvider } from 'react-router';
import { router } from './router';
import { OrganizerAuthProvider } from './auth/organizer/OrganizerAuthProvider';
import { UnauthorizedHandler } from './auth/UnauthorizedHandler';

export default function App() {
  return (
    <OrganizerAuthProvider>
      <UnauthorizedHandler />
      <RouterProvider router={router} />
    </OrganizerAuthProvider>
  );
}
