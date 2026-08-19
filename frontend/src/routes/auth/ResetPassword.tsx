import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, buttonVariants } from '../../components/ui/button';
import { PasswordTextField } from '../../components/ui/password-text-field';
import { AlertDialog } from '../../components/feedback';
import { Wordmark } from '../../components/shared';
import { WarningTriangleIcon } from '../../components/icons';
import { resetPassword } from '../../api/account';
import { ApiError } from '../../api/client';
import { useOrganizerAuth } from '../../auth/organizer/OrganizerAuthContext';
import { paths } from '../../paths';
import { getPasswordError } from '../../features/auth';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const navigate = useNavigate();
  const { establishSession } = useOrganizerAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const passwordError = getPasswordError(password, 'signup');
  const confirmError = confirmPassword !== password ? 'Passwords do not match.' : '';

  // Without a token the link is unusable — don't render the form at all.
  if (!token) {
    return (
      <ResetShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <WarningTriangleIcon />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-text">Invalid reset link</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            This password reset link is missing or malformed. Request a new one to continue.
          </p>
          <Link
            to={paths.forgotPassword}
            className={`${buttonVariants({ size: 'lg' })} mt-6 w-full rounded-lg`}
          >
            Request a new link
          </Link>
        </div>
      </ResetShell>
    );
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);

    if (passwordError || confirmError) return;

    setSubmitting(true);
    try {
      const { token: accessToken, refreshToken } = await resetPassword({
        token,
        newPassword: password,
      });
      // The reset logs the user straight in; hydrate the organizer session and
      // drop them on the dashboard.
      await establishSession(accessToken, refreshToken);
      navigate(paths.organizer.root, { replace: true });
    } catch (err) {
      setServerError(getResetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResetShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Enter a new password for your organizer account. You&apos;ll be signed in once it&apos;s
          saved.
        </p>
      </div>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <PasswordTextField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter a new password"
          helperText="At least 8 characters with one letter and one number."
          error={submitted && passwordError ? passwordError : undefined}
        />

        <PasswordTextField
          id="confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          error={submitted && confirmError ? confirmError : undefined}
        />

        <Button type="submit" size="lg" className="w-full rounded-lg" disabled={submitting}>
          {submitting ? 'Saving…' : 'Reset password'}
        </Button>

        <p className="text-center text-sm text-text-muted">
          <Link to={paths.auth} className="font-semibold text-accent hover:underline">
            Back to login
          </Link>
        </p>
      </form>

      <AlertDialog
        message={serverError}
        title="Couldn’t reset password"
        onAcknowledge={() => setServerError(null)}
      />
    </ResetShell>
  );
}

function ResetShell({ children }: { children: React.ReactNode }) {
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
          {children}
        </section>
      </div>
    </main>
  );
}

function getResetErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }
  // The backend returns 400 both for a bad/expired token and a weak password;
  // we validate the password client-side, so a 400 here means the link is stale.
  if (err.status === 400) {
    return 'This reset link is invalid or has expired. Please request a new one.';
  }
  return err.message || 'Something went wrong. Please try again.';
}
