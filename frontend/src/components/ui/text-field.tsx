import type { InputHTMLAttributes, ReactNode } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: ReactNode;
  helperText?: ReactNode;
  label: ReactNode;
};

const inputClasses =
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:opacity-80 read-only:bg-surface';

export function TextField({ className, error, helperText, id, label, ...props }: TextFieldProps) {
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
      <input
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={mergedClassName}
        id={id}
        {...props}
      />
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
