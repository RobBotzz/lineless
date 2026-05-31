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
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-surface-muted',
      ].join(' ')}
      disabled={disabled}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
