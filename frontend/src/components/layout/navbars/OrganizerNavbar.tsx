import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { buttonVariants } from '../../ui/button';
import { Wordmark } from '../../shared';
import { paths } from '../../../paths';
import { BaseNavbar } from './BaseNavbar';

type NavLink = { label: string; to: string };
type NavButton = { label: string; onClick: () => void };

type OrganizerNavbarProps = {
  logoSrc?: string;
  title?: string;
  className?: string;
  widthClassName?: string;
  centerLinks?: NavLink[];
  rightLink?: NavLink | NavButton;
  right?: ReactNode;
  activeCenterLinkTo?: string;
};

export function OrganizerNavbar({
  logoSrc,
  title = 'lineless',
  className,
  widthClassName,
  centerLinks = [],
  rightLink,
  right: customRight,
  activeCenterLinkTo,
}: OrganizerNavbarProps) {
  const left = (
    // Organizer navbar: the logo returns to the events overview, not the public home.
    <Link className="inline-flex items-center" to={paths.organizer.root}>
      {logoSrc ? (
        <img alt={title} className="h-10 w-10 object-contain" src={logoSrc} />
      ) : title === 'lineless' ? (
        <Wordmark />
      ) : (
        <span className="font-logo text-2xl text-accent">{title}</span>
      )}
    </Link>
  );

  const center =
    centerLinks.length > 0 ? (
      <div className="inline-flex items-center gap-1 rounded-md bg-background p-1">
        {centerLinks.map((link) => {
          const isActive = activeCenterLinkTo === link.to;

          return (
            <Link
              key={link.label}
              className={`${buttonVariants({ variant: 'transparent', size: 'sm' })} text-xs`}
              style={
                isActive
                  ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }
                  : undefined
              }
              to={link.to}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    ) : null;

  const right = customRight ? (
    customRight
  ) : rightLink ? (
    'onClick' in rightLink ? (
      <button
        className={`${buttonVariants({ variant: 'default', size: 'sm' })} text-xs`}
        onClick={rightLink.onClick}
      >
        {rightLink.label}
      </button>
    ) : (
      <Link
        className={`${buttonVariants({ variant: 'default', size: 'sm' })} text-xs`}
        to={rightLink.to}
      >
        {rightLink.label}
      </Link>
    )
  ) : null;

  return (
    <BaseNavbar
      className={className}
      left={left}
      center={center}
      right={right}
      widthClassName={widthClassName}
    />
  );
}
