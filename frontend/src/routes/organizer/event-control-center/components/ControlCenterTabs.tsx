import { Link } from 'react-router';

import { cn } from '@/lib/utils';
import { paths } from '@/paths';

export type ControlCenterSection = 'analytics' | 'management' | 'settings';

// Section sub-navigation for the event control center. Lives on the page (below
// the header) rather than in the top navbar, so the navbar stays uncluttered.
export function ControlCenterTabs({
  eventId,
  active,
}: {
  eventId: string;
  active: ControlCenterSection;
}) {
  const tabs: { id: ControlCenterSection; label: string; to: string }[] = [
    {
      id: 'analytics',
      label: 'Analytics',
      to: paths.organizer.eventControlCenterAnalytics(eventId),
    },
    {
      id: 'management',
      label: 'Management',
      to: paths.organizer.eventControlCenterManagement(eventId),
    },
    { id: 'settings', label: 'Settings', to: paths.organizer.eventControlCenterSettings(eventId) },
  ];

  return (
    <div className="border-b border-border">
      {/* -mb-px lets the active tab's border sit flush on the divider line. */}
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Control center sections">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:border-border hover:text-text',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
