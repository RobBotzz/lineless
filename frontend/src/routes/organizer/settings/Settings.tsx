import { useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { AlertDialog } from '@/components/feedback';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import type { Account } from '@/types/account';
import { getPasswordError } from '@/features/auth/validation';
import type { SettingsActionBody, SettingsActionResult, SettingsLoaderData } from './data';

export function SettingsError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'Your account settings could not be loaded. Check whether the backend is running and try again.';

  return (
    <div>
      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
        {message}
      </div>
    </div>
  );
}

type AccountForm = {
  firstName: string;
  lastName: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function toForm(account: Account): AccountForm {
  return {
    firstName: account.firstName ?? '',
    lastName: account.lastName ?? '',
  };
}

const emptyPasswordForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function Settings() {
  const { account } = useLoaderData() as SettingsLoaderData;
  const fetcher = useFetcher<SettingsActionResult>();
  const [accountForm, setAccountForm] = useState<AccountForm>(() => toForm(account));
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  // Track dismissed errors the same way event-configuration does.
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Both cards share one fetcher, so track which submission is in flight to give
  // each button its own busy state (otherwise both show "Saving...").
  const [submittedIntent, setSubmittedIntent] = useState<SettingsActionBody['intent'] | null>(null);

  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const visibleError = actionError && actionError !== dismissedError ? actionError : null;
  const successMessage =
    fetcher.data?.ok && fetcher.data.intent === 'change-password' ? fetcher.data.message : null;
  const [dismissedSuccess, setDismissedSuccess] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const visibleSuccess =
    successMessage && successMessage !== dismissedSuccess ? successMessage : null;
  const busy = fetcher.state !== 'idle';
  const accountBusy = busy && submittedIntent === 'save-account';
  const passwordBusy = busy && submittedIntent === 'change-password';

  // Clear the password fields once a change succeeds.
  const [prevResult, setPrevResult] = useState(fetcher.data);
  if (fetcher.data !== prevResult) {
    setPrevResult(fetcher.data);
    if (fetcher.data?.ok && fetcher.data.intent === 'change-password') {
      setPasswordForm(emptyPasswordForm);
      setNewPasswordError(null);
    }
  }

  function updateAccountField<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setAccountForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePasswordField<K extends keyof PasswordForm>(key: K, value: PasswordForm[K]) {
    if (key === 'newPassword') setNewPasswordError(null);
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(payload: SettingsActionBody) {
    setSubmittedIntent(payload.intent);
    setDismissedError(null);
    setDismissedSuccess(null);
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function handleAccountSave() {
    submit({ intent: 'save-account', patch: accountForm });
  }

  function handlePasswordSave() {
    const pwdError = getPasswordError(passwordForm.newPassword, 'signup');
    if (pwdError) {
      setNewPasswordError(pwdError);
      return;
    }
    submit({
      intent: 'change-password',
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    });
  }

  return (
    <div className="space-y-8 pb-10">
      <section>
        <h1 className="text-3xl font-bold text-text">Settings</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your account and preferences</p>
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center justify-between gap-3 text-xl">
              <span>Account</span>
              <span
                className="min-w-0 truncate rounded-md bg-surface-muted px-2 py-1 text-right text-sm font-normal text-text-muted"
                title={account.email ?? 'No email available'}
              >
                {account.email ?? 'No email available'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="organizer-first-name"
                  label="First Name"
                  onChange={(e) => updateAccountField('firstName', e.target.value)}
                  placeholder="First name"
                  type="text"
                  value={accountForm.firstName}
                />

                <TextField
                  id="organizer-last-name"
                  label="Last Name"
                  onChange={(e) => updateAccountField('lastName', e.target.value)}
                  placeholder="Last name"
                  type="text"
                  value={accountForm.lastName}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button className="px-6" disabled={accountBusy} onClick={handleAccountSave} size="lg">
                {accountBusy ? 'Saving...' : 'Save Account'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <VisiblePasswordField
                autoComplete="current-password"
                id="current-password"
                label="Current Password"
                onChange={(value) => updatePasswordField('currentPassword', value)}
                placeholder="Current password"
                value={passwordForm.currentPassword}
              />

              <VisiblePasswordField
                autoComplete="new-password"
                error={newPasswordError ?? undefined}
                helperText="At least 8 characters, including a letter and a number. Spaces not allowed."
                id="new-password"
                label="New Password"
                onChange={(value) => updatePasswordField('newPassword', value)}
                placeholder="New password"
                value={passwordForm.newPassword}
              />

              <VisiblePasswordField
                autoComplete="new-password"
                id="confirm-password"
                label="Confirm Password"
                onChange={(value) => updatePasswordField('confirmPassword', value)}
                placeholder="Confirm password"
                value={passwordForm.confirmPassword}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                className="px-6"
                disabled={passwordBusy}
                onClick={handlePasswordSave}
                size="lg"
              >
                {passwordBusy ? 'Saving...' : 'Change Password'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        message={visibleError}
        onAcknowledge={() => setDismissedError(actionError)}
        title="Something went wrong"
      />
      <AlertDialog
        acknowledgeLabel="OK"
        message={visibleSuccess}
        onAcknowledge={() => setDismissedSuccess(successMessage)}
        title="Password changed"
        variant="success"
      />
    </div>
  );
}

function VisiblePasswordField({
  autoComplete,
  error,
  helperText,
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  autoComplete: string;
  error?: string;
  helperText?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 pr-12 text-sm text-text outline-none transition placeholder:text-text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent-soft"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={showPassword ? 'text' : 'password'}
          value={value}
        />
        <Button
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 h-auto w-12 rounded-lg px-0 text-text-muted hover:bg-transparent hover:text-accent"
          onClick={() => setShowPassword((current) => !current)}
          type="button"
          variant="transparent"
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-text-muted">{helperText}</p>
      ) : null}
    </div>
  );
}
