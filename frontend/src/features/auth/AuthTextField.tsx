interface AuthTextFieldProps {
  autoComplete?: string;
  error?: string;
  id?: string;
  label: string;
  maxLength?: number;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  placeholder: string;
  showError?: boolean;
  type?: 'email' | 'text';
  value?: string;
}

export function AuthTextField({
  autoComplete,
  error = '',
  id,
  label,
  maxLength,
  onBlur,
  onChange,
  placeholder,
  showError = false,
  type = 'text',
  value,
}: AuthTextFieldProps) {
  const hasError = showError && Boolean(error);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <label className="block">
      <span className="text-sm font-semibold text-text">{label}</span>
      <input
        className={`mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:ring-4 ${
          hasError
            ? 'border-danger focus:border-danger focus:ring-danger/10'
            : 'border-border focus:border-accent focus:ring-accent-soft'
        }`}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onBlur={onBlur}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        type={type}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
      />
      {hasError ? (
        <span id={errorId} className="mt-2 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
