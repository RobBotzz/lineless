import { Link } from 'react-router';

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
  rightLink: NavbarLink;
  activeCenterLinkTo?: string;
  onCenterLinkClick?: (to: string) => void;
};

export function OrganizerNavbar({
  logoSrc,
  title = 'lineless',
  centerLinks = [],
  rightLink,
  activeCenterLinkTo,
  onCenterLinkClick,
}: OrganizerNavbarProps) {
  const left = (
    <Link className="inline-flex items-center" to="/">
      {logoSrc ? (
        <img alt={title} className="h-10 w-10 object-contain" src={logoSrc} />
      ) : title === 'lineless' ? (
        <span className="font-logo text-2xl text-accent">
          <span className="underline decoration-current decoration-2 underline-offset-4">line</span>
          less
        </span>
      ) : (
        <span className="font-logo text-2xl text-accent">{title}</span>
      )}
    </Link>
  );

  const center = (
    <div className="inline-flex items-center gap-1 rounded-md bg-background p-1">
      {centerLinks.map((link) => {
        const isActive = activeCenterLinkTo === link.to;
        const handleClick = (e: React.MouseEvent) => {
          if (onCenterLinkClick) {
            e.preventDefault();
            onCenterLinkClick(link.to);
          }
        };

        return (
          <a
            key={link.label}
            className={`${buttonVariants({ variant: 'transparent', size: 'sm' })} text-xs`}
            style={
              isActive
                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }
                : undefined
            }
            href={link.to}
            onClick={handleClick}
          >
            {link.label}
          </a>
        );
      })}
    </div>
  );

  const right = (
    <Link
      className={`${buttonVariants({ variant: 'default', size: 'sm' })} text-xs`}
      to={rightLink.to}
    >
      {rightLink.label}
    </Link>
  );

  return <BaseNavbar left={left} center={center} right={right} />;
}
