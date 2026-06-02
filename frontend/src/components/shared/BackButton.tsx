import type { ReactNode } from 'react';
import { Link } from 'react-router';

type BackButtonProps = {
  to: string;
  children?: ReactNode;
  className?: string;
};

export function BackButton({ to, children = 'Zurück', className = '' }: BackButtonProps) {
  return (
    <Link
      className={`inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
      to={to}
    >
      <span className="text-base leading-none" aria-hidden="true">
        &larr;
      </span>
      <span>{children}</span>
    </Link>
  );
}
