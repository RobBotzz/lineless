import { Outlet } from 'react-router';
import { RequireAuth } from '../../auth/RequireAuth';

export default function OrganizerLayout() {
  return (
    <RequireAuth>
      <div>
        <header>Lineless — Organizer</header>
        <main>
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
