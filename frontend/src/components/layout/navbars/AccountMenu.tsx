import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { CreditCardIcon, DashboardIcon, LogOutIcon, UserIcon } from '../../icons';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { paths } from '../../../paths';

type AccountMenuProps = {
  isAuthenticated: boolean;
  onSignOut: () => void;
};

export function AccountMenu({ isAuthenticated, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  const itemClassName =
    'account-menu-panel-item flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-accent-soft hover:text-accent';
  const mutedItemClassName =
    'account-menu-panel-item flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text';
  const iconClassName = 'h-4 w-4 shrink-0';
  // Inline tabs shown when the navbar has room (lg+); below that they collapse
  // into the hamburger dropdown.
  const inlineItemClassName =
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-accent-soft hover:text-accent';
  const inlineMutedItemClassName =
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text';

  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex">
        {isAuthenticated ? (
          <>
            <Link className={inlineItemClassName} to={paths.organizer.root}>
              <DashboardIcon className={iconClassName} />
              <span>Dashboard</span>
            </Link>
            <Link className={inlineItemClassName} to={paths.organizer.payment}>
              <CreditCardIcon className={iconClassName} />
              <span>Payments</span>
            </Link>
            <Link className={inlineItemClassName} to={paths.organizer.settings}>
              <UserIcon className={iconClassName} />
              <span>My Account</span>
            </Link>
            <button className={inlineMutedItemClassName} onClick={onSignOut} type="button">
              <LogOutIcon className={iconClassName} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <Link className={inlineItemClassName} to={paths.auth}>
            <UserIcon className={iconClassName} />
            <span>Sign In</span>
          </Link>
        )}
      </nav>

      <div className="relative lg:hidden" ref={menuRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
          className={[
            'inline-flex h-10 w-10 items-center justify-center text-accent transition-colors hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            open ? 'text-accent/80' : '',
          ].join(' ')}
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span
            className="flex h-5 w-6 flex-col items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            <span
              className={[
                'h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ease-out',
                open ? 'translate-y-2 rotate-45' : '',
              ].join(' ')}
            />
            <span
              className={[
                'h-0.5 w-6 rounded-full bg-current transition-opacity duration-150 ease-out',
                open ? 'opacity-0' : 'opacity-100',
              ].join(' ')}
            />
            <span
              className={[
                'h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ease-out',
                open ? '-translate-y-2 -rotate-45' : '',
              ].join(' ')}
            />
          </span>
        </button>

        {open && (
          <div
            className="account-menu-popover absolute right-0 mt-3 w-60 overflow-hidden rounded-xl border border-border/80 bg-surface [box-shadow:var(--shadow-navbar)]"
            role="menu"
          >
            {isAuthenticated ? (
              <>
                <div className="account-menu-panel-item border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold text-text">Organizer account</p>
                  <p className="mt-0.5 text-xs font-medium text-success">Signed in</p>
                </div>
                <div className="p-1.5">
                  <Link
                    className={itemClassName}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    style={{ animationDelay: '40ms' }}
                    to={paths.organizer.root}
                  >
                    <DashboardIcon className={iconClassName} />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    className={itemClassName}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    style={{ animationDelay: '65ms' }}
                    to={paths.organizer.payment}
                  >
                    <CreditCardIcon className={iconClassName} />
                    <span>Payments</span>
                  </Link>
                  <Link
                    className={itemClassName}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    style={{ animationDelay: '90ms' }}
                    to={paths.organizer.settings}
                  >
                    <UserIcon className={iconClassName} />
                    <span>My Account</span>
                  </Link>
                </div>
                <div className="border-t border-border/70 p-1.5">
                  <button
                    className={mutedItemClassName}
                    onClick={() => {
                      setOpen(false);
                      onSignOut();
                    }}
                    role="menuitem"
                    style={{ animationDelay: '115ms' }}
                    type="button"
                  >
                    <LogOutIcon className={iconClassName} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="account-menu-panel-item border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold text-text">Organizer account</p>
                  <p className="mt-0.5 text-xs text-text-muted">Sign in to manage events.</p>
                </div>
                <div className="p-1.5">
                  <Link
                    className={itemClassName}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    style={{ animationDelay: '40ms' }}
                    to={paths.auth}
                  >
                    <UserIcon className={iconClassName} />
                    <span>Sign In</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
