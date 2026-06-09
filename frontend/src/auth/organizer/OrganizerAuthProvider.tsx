import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { login as apiLogin, signup as apiSignup, getAccountInfo } from '../../api/account';
import { setUnauthorizedHandler } from '../../api/client';
import {
  clearAttendeeSession,
  clearOperatorCredential,
  clearOperatorStand,
  clearOrganizerCredential,
  hasCredential,
  setOrganizer,
} from '../keychain';
import { OrganizerAuthContext } from './OrganizerAuthContext';
import type { OrganizerAuthContextValue, OrganizerAuthStatus } from './OrganizerAuthContext';
import type { Account, LoginInput, SignupInput } from '../../types/account';

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  // If a token is already stored we start as 'loading' until /info confirms it.
  const [status, setStatus] = useState<OrganizerAuthStatus>(() =>
    hasCredential('organizer') ? 'loading' : 'unauthenticated',
  );
  const [account, setAccount] = useState<Account | null>(null);
  // Where OrganizerRequireAuth should send the user after logout (null = default).
  const [logoutRedirect, setLogoutRedirect] = useState<string | null>(null);

  const logout = useCallback((redirectTo?: string) => {
    setLogoutRedirect(redirectTo ?? null);
    clearOrganizerCredential();
    setAccount(null);
    setStatus('unauthenticated');
  }, []);

  // Validate a persisted token on startup; drop it if the backend rejects it.
  useEffect(() => {
    if (!hasCredential('organizer')) return;
    let cancelled = false;
    getAccountInfo()
      .then(({ account }) => {
        if (cancelled) return;
        setAccount(account);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Clear only the credential scope that a 401 came from.
  useEffect(() => {
    setUnauthorizedHandler((scope, ids) => {
      switch (scope) {
        case 'organizer':
          logout();
          break;
        case 'operator':
          if (ids?.standId) clearOperatorStand(ids.standId);
          break;
        case 'operator-link':
          clearOperatorCredential();
          break;
        case 'attendee':
          if (ids?.eventId) clearAttendeeSession(ids.eventId);
          break;
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (input: LoginInput) => {
    const { token } = await apiLogin(input);
    setOrganizer(token);
    const { account } = await getAccountInfo();
    setAccount(account);
    setStatus('authenticated');
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const { token } = await apiSignup(input);
    setOrganizer(token);
    const { account } = await getAccountInfo();
    setAccount(account);
    setStatus('authenticated');
  }, []);

  const value = useMemo<OrganizerAuthContextValue>(
    () => ({
      status,
      account,
      isAuthenticated: status === 'authenticated',
      login,
      signup,
      logout,
      logoutRedirect,
    }),
    [status, account, login, signup, logout, logoutRedirect],
  );

  return <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>;
}
