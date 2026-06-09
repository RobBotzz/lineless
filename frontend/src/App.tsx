import { RouterProvider } from 'react-router';
import { router } from './router';
import { OrganizerAuthProvider } from './auth/organizer/OrganizerAuthProvider';

export default function App() {
  return (
    <OrganizerAuthProvider>
      <RouterProvider router={router} />
    </OrganizerAuthProvider>
  );
}
