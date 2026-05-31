import { Button } from '../../components/ui/button';
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
      <Button
        type="button"
        onClick={() => onChange(isSignup ? 'login' : 'signup')}
        variant="outline"
        className="mt-3 w-full rounded-lg text-accent hover:border-accent hover:bg-accent-soft"
      >
        {isSignup ? 'Login instead' : 'Create an account'}
      </Button>
    </div>
  );
}
