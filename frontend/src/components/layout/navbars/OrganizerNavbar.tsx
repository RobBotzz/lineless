import { Link, NavLink } from 'react-router';

import logoPlaceholder from '../../../assets/LLlogo.png';
import { buttonVariants } from '../../ui/button';
import { Navbar } from './Navbar';

type NavbarLink = {
  label: string;
  to: string;
};

type OrganizerNavbarProps = {
  logoSrc?: string;
  title?: string;
  centerLinks?: NavbarLink[];
  rightLink?: NavbarLink;
};

const defaultCenterLinks: NavbarLink[] = [
  { label: 'Dashboard', to: '/organizer' },
  { label: 'Payment', to: '/organizer/payment' },
  { label: 'Settings', to: '/organizer/settings' },
];

export function OrganizerNavbar({
  logoSrc,
  title = 'Lineless',
  centerLinks = defaultCenterLinks,
  rightLink = { label: 'Logout', to: '/' },
}: OrganizerNavbarProps) {
  return (
    <Navbar
      left={
        <Link className="inline-flex items-center gap-3" to="/">
          <img
            alt={`${title} Logo`}
            className="h-10 w-10 rounded-xl object-contain shadow-sm"
            src={logoSrc ?? logoPlaceholder}
          />
        </Link>
      }
      center={
        <div className="hidden items-center gap-1 rounded-lg bg-surface-muted p-1 md:flex">
          {centerLinks.map((link) => (
            <NavLink
              key={link.label}
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-surface text-accent shadow-sm'
                    : 'text-text-muted hover:bg-surface hover:text-text',
                ].join(' ')
              }
              end={link.to === '/organizer'}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      }
      right={
        <Link className={buttonVariants({ variant: 'default', size: 'sm' })} to={rightLink.to}>
          {rightLink.label}
        </Link>
      }
    />
  );
}
