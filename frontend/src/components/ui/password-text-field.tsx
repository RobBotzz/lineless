import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/icons';

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
          {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
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
