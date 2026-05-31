import type { ActionFunctionArgs } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import { setToken } from '@/auth/tokenStorage';
import type { Account, UpdateAccountInput } from '@/types/account';

export type SettingsLoaderData = {
  account: Account;
};

export type SettingsActionResult =
  | { ok: true; intent: 'save-account' }
  | { ok: true; intent: 'change-password'; message: string }
  | { ok: false; error: string };

type AccountSettingsPatch = Pick<UpdateAccountInput, 'firstName' | 'lastName'>;

type AccountUpdateResponse = {
  message: string;
  account: Account;
};

type PasswordUpdateResponse = {
  message: string;
  token?: string;
};

export type SettingsActionBody =
  | { intent: 'save-account'; patch?: AccountSettingsPatch }
  | {
      intent: 'change-password';
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

export async function settingsLoader(): Promise<SettingsLoaderData> {
  return apiFetch<SettingsLoaderData>('/account/info');
}

// Account settings mutations mirror event-configuration: useFetcher submits JSON,
// successful actions revalidate the loader so the page receives fresh account data.
export async function settingsAction({
  request,
}: ActionFunctionArgs): Promise<SettingsActionResult> {
  const body = (await request.json()) as SettingsActionBody;

  try {
    switch (body.intent) {
      case 'save-account': {
        await apiFetch<AccountUpdateResponse>('/account/update', {
          method: 'PATCH',
          body: JSON.stringify(body.patch ?? {}),
        });
        return { ok: true, intent: 'save-account' };
      }
      case 'change-password': {
        if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
          return { ok: false, error: 'Please fill out all password fields.' };
        }
        if (body.newPassword !== body.confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' };
        }

        const response = await apiFetch<PasswordUpdateResponse>('/account/password', {
          method: 'PATCH',
          body: JSON.stringify({
            currentPassword: body.currentPassword,
            newPassword: body.newPassword,
          }),
        });
        if (response.token) setToken(response.token);
        return {
          ok: true,
          intent: 'change-password',
          message: 'Password changed successfully.',
        };
      }
    }
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
