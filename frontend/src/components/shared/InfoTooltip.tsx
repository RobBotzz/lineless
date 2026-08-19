import { useState, type ReactNode } from 'react';

import { InfoIcon } from '@/components/icons';

interface InfoTooltipProps {
  // Announced by the trigger button (and used as the tooltip's accessible name).
  label: string;
  children: ReactNode;
  // 'bottom' (default) opens the tooltip below the trigger; use 'top' when the
  // trigger sits directly above content the tooltip would otherwise cover.
  side?: 'top' | 'bottom';
  // 'md' (default) matches the settings-page info icons; 'sm' matches compact
  // inline stat labels.
  size?: 'sm' | 'md';
}

// 'md' passes no className so InfoIcon falls back to its own default size
// (its default param only kicks in for `undefined`, not an empty string).
const ICON_CLASS_NAME: Record<'sm' | 'md', string | undefined> = {
  sm: 'h-3.5 w-3.5',
  md: undefined,
};
const TOOLTIP_WIDTH: Record<'sm' | 'md', string> = { sm: 'w-56', md: 'w-72' };

// Click-to-reveal info bubble: a small "i" button that toggles a positioned
// tooltip, dismissed by clicking the button again or anywhere outside it.
// Chosen over a hover-only tooltip because it also works on touch devices.
export function InfoTooltip({ label, children, side = 'bottom', size = 'md' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const positionClassName = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen((isOpen) => !isOpen);
        }}
        className="rounded-full text-text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <InfoIcon className={ICON_CLASS_NAME[size]} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          />
          <span
            role="tooltip"
            className={`absolute left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal leading-relaxed text-text-muted shadow-[0_12px_40px_rgba(31,41,55,0.18)] ${positionClassName} ${TOOLTIP_WIDTH[size]}`}
          >
            {children}
          </span>
        </>
      )}
    </span>
  );
}
