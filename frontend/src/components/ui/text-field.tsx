import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: ReactNode;
  helperText?: ReactNode;
  label: ReactNode;
};

const inputClasses =
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:opacity-80 read-only:bg-surface';

export function TextField({
  className,
  error,
  helperText,
  id,
  label,
  type = 'text',
  ...props
}: TextFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const currentType = isPasswordType && showPassword ? 'text' : type;

  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  const mergedClassName = [
    inputClasses,
    error ? 'border-danger focus:border-danger' : '',
    isPasswordType ? 'pr-10' : '',
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
          type={currentType}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-text-muted hover:text-text focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
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
