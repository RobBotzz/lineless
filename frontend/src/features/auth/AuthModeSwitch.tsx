import type { AuthTab } from './types';

interface AuthModeSwitchProps {
  isSignup: boolean;
  onChange: (tab: AuthTab) => void;
}

export function AuthModeSwitch({ isSignup, onChange }: AuthModeSwitchProps) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-surface-muted p-3 text-center">
      <p className="text-sm font-medium leading-5 text-text-muted">
        {isSignup ? 'Already managing an event?' : 'New to Lineless organizer tools?'}
      </p>
      <button
        type="button"
        onClick={() => onChange(isSignup ? 'login' : 'signup')}
        className="mt-3 h-10 w-full rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent-soft"
      >
        {isSignup ? 'Login instead' : 'Create an account'}
      </button>
    </div>
  );
}
