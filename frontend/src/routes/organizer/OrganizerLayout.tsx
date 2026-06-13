import { Outlet, useLocation } from 'react-router';
import { OrganizerRequireAuth } from '../../auth/organizer/OrganizerRequireAuth';
import { useOrganizerAuth } from '../../auth/organizer/OrganizerAuthContext';
import { OrganizerNavbar } from '../../components/layout';
import { paths } from '../../paths';

export default function OrganizerLayout() {
  const { logout } = useOrganizerAuth();
  const { pathname } = useLocation();
  const isAnalyticsRoute = /^\/organizer\/events\/[^/]+\/analytics\/?$/.test(pathname);

  const centerLinks = [
    { label: 'Dashboard', to: paths.organizer.root },
    { label: 'Payments', to: paths.organizer.payment },
    { label: 'Settings', to: paths.organizer.settings },
  ];

  return (
    <OrganizerRequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar
          activeCenterLinkTo={pathname}
          centerLinks={centerLinks}
          rightLink={{ label: 'Sign Out', onClick: () => logout(paths.home) }}
          widthClassName={
            isAnalyticsRoute
              ? 'w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(80rem-4rem)]'
              : 'w-[calc(100%_-_3rem)] max-w-[calc(56rem-3rem)] lg:w-[calc(100%_-_4rem)] lg:max-w-[calc(56rem-4rem)]'
          }
        />

        <main
          className={
            isAnalyticsRoute
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
