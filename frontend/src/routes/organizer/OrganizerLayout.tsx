import { Outlet } from 'react-router';
import { RequireAuth } from '../../auth/RequireAuth';

import { OrganizerNavbar } from '../../components/layout';

export default function OrganizerLayout() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar />
        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
