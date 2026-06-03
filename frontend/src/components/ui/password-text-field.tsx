import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type PasswordTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  error?: ReactNode;
  helperText?: ReactNode;
  label: ReactNode;
};

const inputClasses =
  'w-full rounded-lg border border-border bg-surface px-4 py-3 pr-11 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:opacity-80';

export function PasswordTextField({
  className,
  error,
  helperText,
  id,
  label,
  ...props
}: PasswordTextFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;
  const mergedClassName = [
    inputClasses,
    error ? 'border-danger focus:border-danger' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={mergedClassName}
          id={id}
          type={showPassword ? 'text' : 'password'}
          {...props}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-text-muted hover:text-text focus:outline-none"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-text-muted" id={helperId}>
          {helperText}
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-danger" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4.5 10 8a11.8 11.8 0 0 1-2.1 3.6" />
      <path d="M6.6 6.6A12 12 0 0 0 2 12c1 3.5 5 8 10 8a10.8 10.8 0 0 0 4.2-.9" />
    </svg>
  );
}
