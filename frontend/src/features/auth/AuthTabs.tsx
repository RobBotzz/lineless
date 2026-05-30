import type { AuthTab } from './types';

interface AuthTabsProps {
  activeTab: AuthTab;
  onChange: (tab: AuthTab) => void;
}

export function AuthTabs({ activeTab, onChange }: AuthTabsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-muted p-1">
      <button
        type="button"
        onClick={() => onChange('login')}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'login'
            ? 'bg-surface text-accent shadow-sm'
            : 'text-text-muted hover:text-text'
        }`}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => onChange('signup')}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
          activeTab === 'signup'
            ? 'bg-surface text-accent shadow-sm'
            : 'text-text-muted hover:text-text'
        }`}
      >
        Sign up
      </button>
    </div>
  );
}
