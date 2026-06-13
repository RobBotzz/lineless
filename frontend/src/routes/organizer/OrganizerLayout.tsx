import { Outlet, useLocation } from 'react-router';
import { OrganizerRequireAuth } from '../../auth/organizer/OrganizerRequireAuth';
import { useOrganizerAuth } from '../../auth/organizer/OrganizerAuthContext';
import { AccountMenu, OrganizerNavbar } from '../../components/layout';
import { paths } from '../../paths';

export default function OrganizerLayout() {
  const { logout } = useOrganizerAuth();
  const { pathname } = useLocation();
  const isEventControlCenterRoute = /^\/organizer\/events\/[^/]+\/event-control-center\/?$/.test(
    pathname,
  );

  return (
    <OrganizerRequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar
          right={<AccountMenu isAuthenticated={true} onSignOut={() => logout(paths.home)} />}
          widthClassName={
            isEventControlCenterRoute
              ? 'w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(80rem-4rem)]'
              : 'w-[calc(100%_-_3rem)] max-w-[calc(56rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(56rem-4rem)]'
          }
        />

        <main
          className={
            isEventControlCenterRoute
              ? 'mx-auto max-w-7xl px-6 py-8 lg:px-8'
              : 'mx-auto max-w-4xl px-6 py-8 lg:px-8'
          }
        >
          <Outlet />
        </main>
      </div>
    </OrganizerRequireAuth>
  );
}
