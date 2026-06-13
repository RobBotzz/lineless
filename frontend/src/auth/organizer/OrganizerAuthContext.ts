import { createContext, useContext } from 'react';
import type { Account, LoginInput, SignupInput } from '../../types/account';

export type OrganizerAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface OrganizerAuthContextValue {
  status: OrganizerAuthStatus;
  account: Account | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  establishSession: (token: string, refreshToken: string) => Promise<void>;
  logout: (redirectTo?: string) => void;
  logoutRedirect: string | null;
}

export const OrganizerAuthContext = createContext<OrganizerAuthContextValue | null>(null);

export function useOrganizerAuth(): OrganizerAuthContextValue {
  const ctx = useContext(OrganizerAuthContext);
  if (!ctx) {
    throw new Error('useOrganizerAuth must be used within an <OrganizerAuthProvider>');
  }
  return ctx;
}
