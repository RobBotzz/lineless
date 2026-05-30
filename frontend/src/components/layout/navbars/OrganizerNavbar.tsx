import { Link } from 'react-router';

import logoPlaceholder from '../../../assets/LLlogo.png';
import { buttonVariants } from '../../ui/button';

type NavbarLink = {
  label: string;
  to: string;
};

type OrganizerNavbarProps = {
  logoSrc?: string;
  title?: string;
  centerLinks: [NavbarLink, NavbarLink, NavbarLink];
  rightLink: NavbarLink;
  activeCenterLinkTo?: string;
};

export function OrganizerNavbar({
  logoSrc,
  title = 'Lineless',
  centerLinks,
  rightLink,
  activeCenterLinkTo,
}: OrganizerNavbarProps) {
  return (
    <header className="sticky top-2 z-50 mx-auto w-[95%] rounded-xl border border-border/70 bg-surface/95 [box-shadow:var(--shadow-navbar)] backdrop-blur supports-[backdrop-filter]:bg-surface/90">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
        <div className="justify-self-start flex items-center">
          <Link className="inline-flex items-center gap-3" to="/">
            <img
              alt={`${title} Logo`}
              className="h-10 w-10 object-contain"
              src={logoSrc ?? logoPlaceholder}
            />
          </Link>
        </div>
        <div className="justify-self-center flex items-center">
          <div className="inline-flex items-center gap-1 rounded-md bg-background p-1">
            {centerLinks.map((link) => {
              const isActive = activeCenterLinkTo === link.to;

              return (
                <Link
                  key={link.label}
                  className={`${buttonVariants({ variant: 'transparent', size: 'sm' })} text-xs`}
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text)',
                        }
                      : undefined
                  }
                  to={link.to}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="justify-self-end flex items-center">
          <Link
            className={`${buttonVariants({ variant: 'default', size: 'sm' })} text-xs`}
            to={rightLink.to}
          >
            {rightLink.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
