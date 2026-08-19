import type { ReactNode } from 'react';

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Used for the accessible name when no visible label wraps the control.
  label?: ReactNode;
  id?: string;
  disabled?: boolean;
};

export function Toggle({ checked, onChange, label, id, disabled }: ToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      className={[
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-70',
        checked
          ? 'border-accent bg-accent shadow-sm'
          : 'border-border bg-surface-muted hover:bg-accent-soft',
      ].join(' ')}
      disabled={disabled}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full border border-border/60 bg-surface shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
