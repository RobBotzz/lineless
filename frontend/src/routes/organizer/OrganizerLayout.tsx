import { Outlet } from 'react-router';
import { RequireAuth } from '../../auth/RequireAuth';
import { useAuth } from '../../auth/AuthContext';
import { OrganizerNavbar } from '../../components/layout';
import { paths } from '../../paths';

export default function OrganizerLayout() {
  const { logout } = useAuth();

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar
          rightLink={{ label: 'Sign Out', onClick: () => logout(paths.home) }}
          widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(56rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(56rem-4rem)]"
        />

        <main className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
