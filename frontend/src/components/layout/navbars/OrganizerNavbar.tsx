import { Link, NavLink } from 'react-router';

import logoPlaceholder from '../../../assets/LLlogo.png';
import { buttonVariants } from '../../ui/button';
import { BaseNavbar } from './BaseNavbar';

type NavbarLink = {
  label: string;
  to: string;
};

type OrganizerNavbarProps = {
  logoSrc?: string;
  title?: string;
  centerLinks?: NavbarLink[];
  rightLink?: NavbarLink;
  // Active anchor for the landing-page scroll-spy. Only used for hash links.
  activeCenterLinkTo?: string;
  onCenterLinkClick?: (to: string) => void;
};

const defaultCenterLinks: NavbarLink[] = [
  { label: 'Dashboard', to: '/organizer' },
  { label: 'Payment', to: '/organizer/payment' },
  { label: 'Settings', to: '/organizer/settings' },
];

const linkClass = (isActive: boolean) =>
  [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-surface text-accent shadow-sm'
      : 'text-text-muted hover:bg-surface hover:text-text',
  ].join(' ');

export function OrganizerNavbar({
  logoSrc,
  title = 'Lineless',
  centerLinks = defaultCenterLinks,
  rightLink = { label: 'Logout', to: '/' },
  activeCenterLinkTo,
  onCenterLinkClick,
}: OrganizerNavbarProps) {
  const left = (
    <Link className="inline-flex items-center gap-3" to="/">
      <img
        alt={`${title} Logo`}
        className="h-10 w-10 rounded-xl object-contain shadow-sm"
        src={logoSrc ?? logoPlaceholder}
      />
    </Link>
  );

  const center = (
    <div className="hidden items-center gap-1 rounded-lg bg-surface-muted p-1 md:flex">
      {centerLinks.map((link) => {
        // Hash links (landing-page sections) scroll in-page and get their
        // active state from the scroll-spy; real routes use NavLink instead.
        if (link.to.startsWith('#')) {
          const isActive = activeCenterLinkTo === link.to;
          return (
            <a
              key={link.label}
              className={linkClass(isActive)}
              href={link.to}
              onClick={(e) => {
                if (onCenterLinkClick) {
                  e.preventDefault();
                  onCenterLinkClick(link.to);
                }
              }}
            >
              {link.label}
            </a>
          );
        }

        return (
          <NavLink
            key={link.label}
            className={({ isActive }) => linkClass(isActive)}
            end={link.to === '/organizer'}
            to={link.to}
          >
            {link.label}
          </NavLink>
        );
      })}
    </div>
  );

  const right = (
    <Link className={buttonVariants({ variant: 'default', size: 'sm' })} to={rightLink.to}>
      {rightLink.label}
    </Link>
  );

  return <BaseNavbar left={left} center={center} right={right} />;
}
