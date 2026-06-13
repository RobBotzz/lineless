import type { AuthTab } from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signupPasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,}$/;

export function getEmailError(email: string): string {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return 'Email is required.';
  if (!emailPattern.test(trimmedEmail)) return 'Enter a valid email address.';
  return '';
}

export function getPasswordError(password: string, mode: AuthTab): string {
  if (!password) return 'Password is required.';
  if (mode === 'signup' && !signupPasswordPattern.test(password)) {
    return 'Use 8–128 printable characters with at least one letter and one number. No spaces or emoji.';
  }
  return '';
}
