import type { ActionFunctionArgs } from 'react-router';

import { apiFetch, ApiError } from '@/api/client';
import { setToken } from '@/auth/tokenStorage';
import type { Account, UpdateAccountInput } from '@/types/account';

export type SettingsLoaderData = {
  account: Account;
};

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

type AccountUpdateResponse = {
  message: string;
  account: Account;
  token?: string;
};

export type SettingsActionBody =
  | { intent: 'save-account'; patch?: UpdateAccountInput }
  | {
      intent: 'change-password';
      email?: string;
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
        const response = await apiFetch<AccountUpdateResponse>('/account/update', {
          method: 'PUT',
          body: JSON.stringify(body.patch ?? {}),
        });
        if (response.token) setToken(response.token);
        break;
      }
      case 'change-password': {
        if (!body.email || !body.currentPassword || !body.newPassword || !body.confirmPassword) {
          return { ok: false, error: 'Please fill out all password fields.' };
        }
        if (body.newPassword !== body.confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' };
        }

        await apiFetch('/account/login', {
          method: 'POST',
          body: JSON.stringify({ email: body.email, password: body.currentPassword }),
          auth: false,
        });
        await apiFetch('/account/update', {
          method: 'PUT',
          body: JSON.stringify({ password: body.newPassword } satisfies UpdateAccountInput),
        });
        break;
      }
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
}
