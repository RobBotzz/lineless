import type { ReactNode } from 'react';

type OperatorNavbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
};

export function OperatorNavbar({ left = null, center = null, right = null }: OperatorNavbarProps) {
  return (
    <header className="sticky top-2 z-50 mx-auto w-[95%] rounded-xl border border-border/70 bg-surface/95 [box-shadow:var(--shadow-navbar)] backdrop-blur supports-[backdrop-filter]:bg-surface/90">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
        <div className="justify-self-start flex items-center">{left}</div>
        <div className="justify-self-center flex items-center">{center}</div>
        <div className="justify-self-end flex items-center">{right}</div>
      </div>
    </header>
  );
}
