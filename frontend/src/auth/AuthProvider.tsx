import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { login as apiLogin, signup as apiSignup, getAccountInfo } from '../api/account';
import { setUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from './tokenStorage';
import { AuthContext } from './AuthContext';
import type { AuthContextValue, AuthStatus } from './AuthContext';
import type { Account, LoginInput, SignupInput } from '../types/account';

export function AuthProvider({ children }: { children: ReactNode }) {
  // If a token is already stored we start as 'loading' until /info confirms it.
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? 'loading' : 'unauthenticated',
  );
  const [account, setAccount] = useState<Account | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setAccount(null);
    setStatus('unauthenticated');
  }, []);

  // Validate a persisted token on startup; drop it if the backend rejects it.
  useEffect(() => {
    if (!getToken()) return;
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

  // Let any authed 401 anywhere in the app force a logout.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (input: LoginInput) => {
    const { token } = await apiLogin(input);
    setToken(token);
    const { account } = await getAccountInfo();
    setAccount(account);
    setStatus('authenticated');
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const { token } = await apiSignup(input);
    setToken(token);
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
    }),
    [status, account, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
