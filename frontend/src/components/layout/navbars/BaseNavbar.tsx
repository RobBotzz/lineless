import type { ReactNode } from 'react';

type BaseNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
  widthClassName?: string;
  paddingClassName?: string;
};

export function BaseNavbar({
  left,
  center,
  right,
  className = '',
  widthClassName = 'w-[calc(100%_-_3rem)] max-w-7xl',
  paddingClassName = 'px-4 py-2 sm:px-6 lg:px-8',
}: BaseNavbarProps) {
  return (
    <header
      className={`sticky top-2 z-[1001] mx-auto rounded-xl border border-border/70 bg-surface/95 [box-shadow:var(--shadow-navbar)] backdrop-blur supports-backdrop-filter:bg-surface/90 ${widthClassName} ${className}`}
    >
      <div
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 ${paddingClassName}`}
      >
        <div className="flex min-w-0 items-center justify-self-start">{left}</div>
        <div className="flex min-w-0 max-w-full items-center justify-self-center overflow-x-auto">
          {center}
        </div>
        <div className="flex min-w-0 items-center justify-self-end">{right}</div>
      </div>
    </header>
  );
}
