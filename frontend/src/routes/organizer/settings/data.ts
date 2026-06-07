import type { ActionFunctionArgs } from 'react-router';

import { getAccountInfo, updateOrganizerAccount, updateOrganizerPassword } from '@/api/account';
import { ApiError } from '@/api/client';
import { setOrganizerToken } from '@/auth/keychain';
import type { Account, UpdateAccountInput } from '@/types/account';

export type SettingsLoaderData = {
  account: Account;
};

export type SettingsActionResult =
  | { ok: true; intent: 'save-account' }
  | { ok: true; intent: 'change-password'; message: string }
  | { ok: false; error: string };

type AccountSettingsPatch = Pick<UpdateAccountInput, 'firstName' | 'lastName'>;

export type SettingsActionBody =
  | { intent: 'save-account'; patch?: AccountSettingsPatch }
  | {
      intent: 'change-password';
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

export async function settingsLoader(): Promise<SettingsLoaderData> {
  return getAccountInfo();
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
        await updateOrganizerAccount(body.patch ?? {});
        return { ok: true, intent: 'save-account' };
      }
      case 'change-password': {
        if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
          return { ok: false, error: 'Please fill out all password fields.' };
        }
        if (body.newPassword !== body.confirmPassword) {
          return { ok: false, error: 'New password and confirmation do not match.' };
        }

        const response = await updateOrganizerPassword({
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
        });
        if (response.token) setOrganizerToken(response.token);
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
