import { Link } from 'react-router';

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
  centerLinks: [NavbarLink, NavbarLink, NavbarLink];
  rightLink: NavbarLink;
};

export function OrganizerNavbar({
  logoSrc,
  title = 'Lineless',
  centerLinks,
  rightLink,
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
        <div className="flex items-center gap-2">
          {centerLinks.map((link) => (
            <Link
              key={link.label}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              to={link.to}
            >
              {link.label}
            </Link>
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
