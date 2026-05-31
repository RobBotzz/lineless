import { Button } from '../../components/ui/button';
import type { AuthTab } from './types';

interface AuthTabsProps {
  activeTab: AuthTab;
  onChange: (tab: AuthTab) => void;
}

export function AuthTabs({ activeTab, onChange }: AuthTabsProps) {
  function getTabVariant(tab: AuthTab) {
    return activeTab === tab ? 'outline' : 'transparent';
  }

  function getTabClassName(tab: AuthTab) {
    return activeTab === tab
      ? 'w-full rounded-md border-0 text-accent shadow-sm hover:bg-surface'
      : 'w-full rounded-md text-text-muted hover:bg-transparent hover:text-text';
  }

  return (
    <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-muted p-1">
      <Button
        type="button"
        onClick={() => onChange('login')}
        variant={getTabVariant('login')}
        className={getTabClassName('login')}
      >
        Login
      </Button>
      <Button
        type="button"
        onClick={() => onChange('signup')}
        variant={getTabVariant('signup')}
        className={getTabClassName('signup')}
      >
        Sign up
      </Button>
    </div>
  );
}
