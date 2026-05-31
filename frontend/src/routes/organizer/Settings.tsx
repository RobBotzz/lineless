import { useState } from 'react';
import { useFetcher, useLoaderData, useRouteError } from 'react-router';

import { ApiError } from '@/api/client';
import { AlertDialog } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import type { Account } from '@/types/account';
import type { SettingsActionBody, SettingsActionResult, SettingsLoaderData } from './settings/data';

export function SettingsError() {
  const error = useRouteError();
  const message =
    error instanceof ApiError
      ? error.message
      : 'Your account settings could not be loaded. Check whether the backend is running and try again.';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-5 text-sm text-text">
        {message}
      </div>
    </div>
  );
}

type AccountForm = {
  firstName: string;
  lastName: string;
  email: string;
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
    email: account.email ?? '',
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

  const actionError = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const visibleError = actionError && actionError !== dismissedError ? actionError : null;
  const busy = fetcher.state !== 'idle';

  function updateAccountField<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setAccountForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePasswordField<K extends keyof PasswordForm>(key: K, value: PasswordForm[K]) {
    setPasswordForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(payload: SettingsActionBody) {
    setDismissedError(null);
    void fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
      method: 'post',
      encType: 'application/json',
    });
  }

  function handleAccountSave() {
    submit({ intent: 'save-account', patch: accountForm });
  }

  function handlePasswordSave() {
    submit({
      intent: 'change-password',
      email: account.email,
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <section>
        <h1 className="text-3xl font-bold text-text">Settings</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your account and preferences</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Account</CardTitle>
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

            <TextField
              id="organizer-email"
              label="Email"
              onChange={(e) => updateAccountField('email', e.target.value)}
              placeholder="Email"
              type="email"
              value={accountForm.email}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="px-6" disabled={busy} onClick={handleAccountSave} size="lg">
              {busy ? 'Saving...' : 'Save Account'}
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
              helperText="At least 8 characters, including one letter and one number."
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
            <Button className="px-6" disabled={busy} onClick={handlePasswordSave} size="lg">
              {busy ? 'Saving...' : 'Change Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        message={visibleError}
        onAcknowledge={() => setDismissedError(actionError)}
        title="Something went wrong"
      />
    </div>
  );
}

function VisiblePasswordField({
  autoComplete,
  helperText,
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  autoComplete: string;
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
      {helperText ? <p className="mt-1.5 text-xs text-text-muted">{helperText}</p> : null}
    </div>
  );
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
