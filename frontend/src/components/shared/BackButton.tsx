import type { ReactNode } from 'react';
import { Link } from 'react-router';

const BACK_BUTTON_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Either links to a fixed destination (`to`) or runs a handler (`onClick`, e.g.
// history back) — exactly one is provided.
type BackButtonProps = {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
};

export function BackButton({ to, onClick, children, className = '' }: BackButtonProps) {
  const content = (
    <>
      <span className="text-base leading-none" aria-hidden="true">
        &larr;
      </span>
      <span>{children}</span>
    </>
  );

  if (to) {
    return (
      <Link className={`${BACK_BUTTON_CLASS} ${className}`} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className={`${BACK_BUTTON_CLASS} ${className}`} onClick={onClick} type="button">
      {content}
    </button>
  );
}
