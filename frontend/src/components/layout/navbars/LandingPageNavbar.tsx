import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { buttonVariants } from '../../ui/button';
import { Wordmark } from '../../shared';
import { paths } from '../../../paths';
import { BaseNavbar } from './BaseNavbar';

type NavLink = { label: string; to: string };
type NavButton = { label: string; onClick: () => void };

type LandingPageNavbarProps = {
  logoSrc?: string;
  title?: string;
  className?: string;
  widthClassName?: string;
  centerLinks?: NavLink[];
  rightLink?: NavLink | NavButton;
  right?: ReactNode;
  activeCenterLinkTo?: string;
  onCenterLinkClick?: (to: string) => void;
  // Where the logo links to. Defaults to the public home; pass an area root
  // (e.g. the organizer dashboard) to keep the logo within that area.
  logoTo?: string;
};

export function LandingPageNavbar({
  logoSrc,
  title = 'lineless',
  className,
  widthClassName,
  centerLinks = [],
  rightLink,
  right: customRight,
  activeCenterLinkTo,
  onCenterLinkClick,
  logoTo = paths.home,
}: LandingPageNavbarProps) {
  const left = (
    <Link className="inline-flex items-center" to={logoTo}>
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
