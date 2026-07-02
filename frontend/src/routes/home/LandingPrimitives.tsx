import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon } from '../../components/icons';
import { buttonVariants } from '../../components/ui/button';
import { paths } from '../../paths';

export function PrimaryCta({ status, className = '' }: { status: string; className?: string }) {
  const authenticated = status !== 'unauthenticated';

  return (
    <Link
      className={`${buttonVariants({ variant: 'default', size: 'lg' })} landing-cta gap-2 ${className}`}
      to={authenticated ? paths.organizer.root : paths.auth}
    >
      {authenticated ? 'Go to my dashboard' : 'Plan your first event'}
      <ArrowRightIcon />
    </Link>
  );
}

export function WindowShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[1.35rem] border border-border bg-surface shadow-[0_30px_80px_rgba(2,8,135,0.2)] ${className}`}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-surface px-3">
        <span className="h-2 w-2 rounded-full bg-accent/20" />
        <span className="h-2 w-2 rounded-full bg-accent/40" />
        <span className="h-2 w-2 rounded-full bg-accent" />
      </div>
      {children}
    </div>
  );
}
