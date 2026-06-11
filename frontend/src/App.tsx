import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { OrganizerAuthProvider } from './auth/organizer/OrganizerAuthProvider';
import { UnauthorizedHandler } from './auth/UnauthorizedHandler';
import { queryClient } from './lib/queryClient';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OrganizerAuthProvider>
        <UnauthorizedHandler />
        <RouterProvider router={router} />
      </OrganizerAuthProvider>
    </QueryClientProvider>
  );
}
