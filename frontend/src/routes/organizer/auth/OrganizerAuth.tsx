import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { AuthModeSwitch, AuthTabs, PasswordField, type AuthTab } from '../../../features/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signupPasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

export default function OrganizerAuth() {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const isSignup = activeTab === 'signup';
  const shouldShowEmailError = touched.email || submitted;
  const shouldShowPasswordError = touched.password || submitted;
  const emailError = !email.trim()
    ? 'Email is required.'
    : !emailPattern.test(email)
      ? 'Enter a valid email address.'
      : '';
  const passwordError = !password
    ? 'Password is required.'
    : isSignup && !signupPasswordPattern.test(password)
      ? 'Use at least 8 characters with one letter and one number.'
      : '';

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSubmitted(true);
  }

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setTouched({ email: false, password: false });
    setSubmitted(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          //TODO: Replace with logo
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
                <label className="block">
                  <span className="text-sm font-semibold text-text">First name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    placeholder="Emely"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-text">Last name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    placeholder="Meyer"
                  />
                </label>
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-text">Email</span>
              <input
                className={`mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:ring-4 ${
                  shouldShowEmailError && emailError
                    ? 'border-danger focus:border-danger focus:ring-danger/10'
                    : 'border-border focus:border-accent focus:ring-accent-soft'
                }`}
                value={email}
                onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="organizer@lineless.app"
                type="email"
                aria-invalid={shouldShowEmailError && Boolean(emailError)}
                aria-describedby={shouldShowEmailError && emailError ? 'email-error' : undefined}
              />
              {shouldShowEmailError && emailError ? (
                <span id="email-error" className="mt-2 block text-xs font-medium text-danger">
                  {emailError}
                </span>
              ) : null}
            </label>

            <PasswordField
              error={passwordError}
              isSignup={isSignup}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              onChange={setPassword}
              showError={shouldShowPasswordError}
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
