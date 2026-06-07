import { clearCredential, getCredential, setOrganizerToken } from './keychain';

export function getToken(): string | null {
  return getCredential('organizer')?.token ?? null;
}

export function setToken(token: string): void {
  setOrganizerToken(token);
}

export function clearToken(): void {
  clearCredential('organizer');
}
