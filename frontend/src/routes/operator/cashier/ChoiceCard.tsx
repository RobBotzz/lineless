import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface ChoiceCardProps {
  // Omit to render a static, non-interactive tile (e.g. an upcoming feature).
  to?: string;
  icon: ReactNode;
  title: string;
  description: string;
  // Render as a dimmed, non-clickable tile even when `to` is set (e.g. the
  // action is temporarily unavailable because the event is stopped).
  disabled?: boolean;
}

const baseClassName =
  'flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-8 py-12 text-center shadow-sm';
const interactiveClassName =
  'transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const disabledClassName = 'cursor-not-allowed opacity-60';

// Large icon + title + description card for the cashier's Manual Order / Cash
// Payment choice screen. Renders as a Link when `to` is set and not disabled,
// otherwise as a plain (non-clickable) tile so it can stand in for a
// not-yet-built or temporarily unavailable action.
export function ChoiceCard({ to, icon, title, description, disabled = false }: ChoiceCardProps) {
  const content = (
    <>
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="text-2xl font-bold text-accent">{title}</span>
      <span className="text-sm text-text-muted">{description}</span>
    </>
  );

  if (!to || disabled) {
    return (
      <div
        className={`${baseClassName}${disabled ? ` ${disabledClassName}` : ''}`}
        aria-disabled={disabled || undefined}
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={`${baseClassName} ${interactiveClassName}`}>
      {content}
    </Link>
  );
}
