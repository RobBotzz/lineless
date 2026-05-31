import { useState } from 'react';
import { Button } from '../../components/ui/button';

interface PasswordFieldProps {
  error: string;
  isSignup: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
  showError: boolean;
  value: string;
}

export function PasswordField({
  error,
  isSignup,
  onBlur,
  onChange,
  showError,
  value,
}: PasswordFieldProps) {
  const hasError = showError && Boolean(error);
  const [showPassword, setShowPassword] = usePasswordVisibility();

  return (
    <div className="block">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-text">
        Password
        {!isSignup ? (
          <Button
            type="button"
            variant="transparent"
            size="sm"
            className="h-auto px-0 text-sm font-semibold text-accent hover:bg-transparent hover:underline"
          >
            Forgot password?
          </Button>
        ) : null}
      </span>
      <div className="relative mt-2">
        <input
          className={`h-11 w-full rounded-lg border bg-surface px-3 pr-11 text-sm text-text outline-none transition placeholder:text-text-muted focus:ring-4 ${
            hasError
              ? 'border-danger focus:border-danger focus:ring-danger/10'
              : 'border-border focus:border-accent focus:ring-accent-soft'
          }`}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter your password"
          type={showPassword ? 'text' : 'password'}
          aria-invalid={hasError}
          aria-describedby={hasError ? 'password-error' : isSignup ? 'password-help' : undefined}
        />
        <Button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          variant="transparent"
          className="absolute inset-y-0 right-0 h-auto w-11 rounded-lg px-0 text-text-muted hover:bg-transparent hover:text-accent"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {isSignup ? (
        <div
          id="password-help"
          className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium leading-5 text-accent"
        >
          Password must include at least 8 characters, one letter and one number.
        </div>
      ) : null}
      {hasError ? (
        <span id="password-error" className="mt-2 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function usePasswordVisibility() {
  return useState(false);
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
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
      className="h-5 w-5"
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
