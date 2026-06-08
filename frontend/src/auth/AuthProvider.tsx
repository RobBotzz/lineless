import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { login as apiLogin, signup as apiSignup, getAccountInfo } from '../api/account';
import { setUnauthorizedHandler } from '../api/client';
import { clearCredential, clearOperatorStand, hasCredential, setOrganizer } from './keychain';
import { AuthContext } from './AuthContext';
import type { AuthContextValue, AuthStatus } from './AuthContext';
import type { Account, LoginInput, SignupInput } from '../types/account';

export function AuthProvider({ children }: { children: ReactNode }) {
  // If a token is already stored we start as 'loading' until /info confirms it.
  const [status, setStatus] = useState<AuthStatus>(() =>
    hasCredential('organizer') ? 'loading' : 'unauthenticated',
  );
  const [account, setAccount] = useState<Account | null>(null);
  // Where RequireAuth should send the user after this logout (null = default).
  const [logoutRedirect, setLogoutRedirect] = useState<string | null>(null);

  const logout = useCallback((redirectTo?: string) => {
    setLogoutRedirect(redirectTo ?? null);
    clearCredential('organizer');
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
    setUnauthorizedHandler((scope, standId) => {
      switch (scope) {
        case 'organizer':
          logout();
          break;
        case 'operator':
          if (standId) clearOperatorStand(standId);
          break;
        case 'operator-link':
          clearCredential('operator');
          break;
        case 'attendee':
          clearCredential('attendee');
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

  const value = useMemo<AuthContextValue>(
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
