import { Outlet } from 'react-router';
import { OrganizerRequireAuth } from '../../auth/organizer/OrganizerRequireAuth';
import { useOrganizerAuth } from '../../auth/organizer/OrganizerAuthContext';
import { AccountMenu, OrganizerNavbar } from '../../components/layout';
import { paths } from '../../paths';

export default function OrganizerLayout() {
  const { logout } = useOrganizerAuth();

  return (
    <OrganizerRequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar
          right={<AccountMenu isAuthenticated={true} onSignOut={() => logout(paths.home)} />}
          widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(56rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(56rem-4rem)]"
        />

        <main className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </OrganizerRequireAuth>
  );
}
