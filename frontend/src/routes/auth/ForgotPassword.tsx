import { useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '../../components/ui/button';
import { AlertDialog } from '../../components/feedback';
import { Wordmark } from '../../components/shared';
import { CheckIcon } from '../../components/icons';
import { requestPasswordReset } from '../../api/account';
import { ApiError } from '../../api/client';
import { paths } from '../../paths';
import { AuthTextField, getEmailError } from '../../features/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const emailError = getEmailError(email);
  const showEmailError = touched || submitted;

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);

    if (emailError) return;

    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setServerError(getResetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div aria-label="lineless">
            <Wordmark className="text-5xl sm:text-6xl" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase text-text-muted">Organizer access</p>
        </div>

        <section className="w-full rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.1)] sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckIcon className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-text">Check your inbox</h1>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                If an account exists for{' '}
                <span className="font-semibold text-text">{email.trim()}</span>, we&apos;ve sent a
                link to reset your password. The link expires shortly, so use it soon.
              </p>
              <Link
                to={paths.auth}
                className={`${buttonVariants({ size: 'lg' })} mt-6 w-full rounded-lg`}
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-text">Forgot your password?</h1>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Enter the email address tied to your organizer account and we&apos;ll send you a
                  link to reset your password.
                </p>
              </div>

              <form className="space-y-4" noValidate onSubmit={handleSubmit}>
                <AuthTextField
                  autoComplete="email"
                  error={emailError}
                  id="email"
                  label="Email"
                  onBlur={() => setTouched(true)}
                  onChange={setEmail}
                  placeholder="organizer@lineless.app"
                  showError={showEmailError}
                  type="email"
                  value={email}
                />

                <Button type="submit" size="lg" className="w-full rounded-lg" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Button>

                <p className="text-center text-sm text-text-muted">
                  Remembered it?{' '}
                  <Link to={paths.auth} className="font-semibold text-accent hover:underline">
                    Back to login
                  </Link>
                </p>
              </form>
            </>
          )}

          <AlertDialog
            message={serverError}
            title="Couldn’t send reset link"
            onAcknowledge={() => setServerError(null)}
          />
        </section>
      </div>
    </main>
  );
}

function getResetErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }
  if (err.status === 400) {
    return 'Please enter a valid email address.';
  }
  if (err.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  return err.message || 'Something went wrong. Please try again.';
}
