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
        {/* The event control center's section tabs live on the page itself (below
            the header), not in the navbar — so the navbar stays free of them. */}
        <OrganizerNavbar
          right={<AccountMenu isAuthenticated={true} onSignOut={() => logout(paths.home)} />}
          // One consistent width for every organizer page (matches the event page),
          // responsive down to narrow tablets via the calc() insets.
          widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(80rem-4rem)]"
        />

        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </OrganizerRequireAuth>
  );
}
