import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import {
  AuthModeSwitch,
  AuthTabs,
  AuthTextField,
  PasswordField,
  getEmailError,
  getPasswordError,
  type AuthTab,
} from '../../../features/auth';

type AuthField = 'email' | 'password';
type SubmitEvent = { preventDefault: () => void };

const initialTouched: Record<AuthField, boolean> = {
  email: false,
  password: false,
};

export default function OrganizerAuth() {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(initialTouched);
  const [submitted, setSubmitted] = useState(false);

  const isSignup = activeTab === 'signup';
  const emailError = getEmailError(email);
  const passwordError = getPasswordError(password, activeTab);
  const showEmailError = touched.email || submitted;
  const showPasswordError = touched.password || submitted;

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (emailError || passwordError) return;

    // TODO: Send login/signup payload to the organizer auth backend here.
  }

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setTouched(initialTouched);
    setSubmitted(false);
  }

  function markTouched(field: AuthField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-5xl font-black text-accent sm:text-6xl">Lineless</p>
          <p className="mt-3 text-xs font-semibold uppercase text-text-muted">Organizer access</p>
        </div>

        <section className="w-full rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.1)] sm:p-8">
          <AuthTabs activeTab={activeTab} onChange={switchTab} />

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {isSignup
                ? 'Create an organizer account to manage events with Lineless.'
                : 'Login to continue to your organizer dashboard.'}
            </p>
          </div>

          <form className="space-y-4" noValidate onSubmit={handleSubmit}>
            {isSignup ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthTextField
                  autoComplete="given-name"
                  label="First name"
                  onChange={setFirstName}
                  placeholder="Emely"
                  value={firstName}
                />
                <AuthTextField
                  autoComplete="family-name"
                  label="Last name"
                  onChange={setLastName}
                  placeholder="Meyer"
                  value={lastName}
                />
              </div>
            ) : null}

            <AuthTextField
              autoComplete="email"
              error={emailError}
              id="email"
              label="Email"
              onBlur={() => markTouched('email')}
              onChange={setEmail}
              placeholder="organizer@lineless.app"
              showError={showEmailError}
              type="email"
              value={email}
            />

            <PasswordField
              error={passwordError}
              isSignup={isSignup}
              onBlur={() => markTouched('password')}
              onChange={setPassword}
              showError={showPasswordError}
              value={password}
            />

            <Button type="submit" size="lg" className="w-full rounded-lg">
              {isSignup ? 'Create account' : 'Login'}
            </Button>
          </form>

          <AuthModeSwitch isSignup={isSignup} onChange={switchTab} />
        </section>
      </div>
    </main>
  );
}
