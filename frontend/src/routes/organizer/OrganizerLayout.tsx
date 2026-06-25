import { Outlet, useMatch } from 'react-router';
import { OrganizerRequireAuth } from '../../auth/organizer/OrganizerRequireAuth';
import { useOrganizerAuth } from '../../auth/organizer/OrganizerAuthContext';
import { AccountMenu, OrganizerNavbar } from '../../components/layout';
import { paths } from '../../paths';

export default function OrganizerLayout() {
  const { logout } = useOrganizerAuth();
  const eventControlCenterMatch = useMatch({
    path: '/organizer/events/:eventId/event-control-center/:section',
    end: false,
  });
  const eventControlCenterEventId = eventControlCenterMatch?.params.eventId;
  const eventControlCenterSection = eventControlCenterMatch?.params.section;
  const eventControlCenterLinks = eventControlCenterEventId
    ? [
        {
          label: 'Analytics',
          to: paths.organizer.eventControlCenterAnalytics(eventControlCenterEventId),
        },
        {
          label: 'Management',
          to: paths.organizer.eventControlCenterManagement(eventControlCenterEventId),
        },
        {
          label: 'Settings',
          to: paths.organizer.eventControlCenterSettings(eventControlCenterEventId),
        },
      ]
    : [];
  const activeEventControlCenterLinkTo =
    eventControlCenterEventId && eventControlCenterSection === 'management'
      ? paths.organizer.eventControlCenterManagement(eventControlCenterEventId)
      : eventControlCenterEventId && eventControlCenterSection === 'settings'
        ? paths.organizer.eventControlCenterSettings(eventControlCenterEventId)
        : eventControlCenterEventId
          ? paths.organizer.eventControlCenterAnalytics(eventControlCenterEventId)
          : undefined;

  return (
    <OrganizerRequireAuth>
      <div className="min-h-screen bg-background">
        <OrganizerNavbar
          activeCenterLinkTo={activeEventControlCenterLinkTo}
          centerLinks={eventControlCenterLinks}
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
