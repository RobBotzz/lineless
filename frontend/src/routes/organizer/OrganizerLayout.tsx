import { Outlet } from 'react-router';
import { RequireAuth } from '../../auth/RequireAuth';
import { useAuth } from '../../auth/AuthContext';
import { OrganizerNavbar } from '../../components/layout';

export default function OrganizerLayout() {
  const { logout } = useAuth();

  return (
    <RequireAuth>
      <div>
        <OrganizerNavbar rightLink={{ label: 'Sign Out', onClick: () => logout('/') }} />
        <header>Lineless — Organizer</header>
        <main>
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
