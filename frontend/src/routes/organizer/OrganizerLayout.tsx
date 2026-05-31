import { Outlet } from 'react-router';
import { RequireAuth } from '../../auth/RequireAuth';

import { OrganizerNavbar } from '../../components/layout';

export default function OrganizerLayout() {
  return (
    <RequireAuth>
      <div>
        <OrganizerNavbar />
        <header>Lineless — Organizer</header>
        <main>
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
