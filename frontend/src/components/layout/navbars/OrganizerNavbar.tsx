import { Link } from 'react-router';

import { buttonVariants } from '../../ui/button';
import { paths } from '../../../paths';
import { BaseNavbar } from './BaseNavbar';

type NavLink = { label: string; to: string };
type NavButton = { label: string; onClick: () => void };

type OrganizerNavbarProps = {
  logoSrc?: string;
  title?: string;
  centerLinks?: NavLink[];
  rightLink?: NavLink | NavButton;
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
    <Link className="inline-flex items-center" to={paths.home}>
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

  const right = rightLink ? (
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

  return <BaseNavbar left={left} center={center} right={right} />;
}
