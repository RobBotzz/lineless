import type { AuthTab } from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signupPasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,128}$/;

export function getEmailError(email: string): string {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return 'Email is required.';
  if (!emailPattern.test(trimmedEmail)) return 'Enter a valid email address.';
  return '';
}

export function getPasswordError(password: string, mode: AuthTab): string {
  if (!password) return 'Password is required.';
  if (mode === 'signup') {
    if (password.length > 128) return 'Password must be at most 128 characters.';
    if (!signupPasswordPattern.test(password)) {
      return 'Use at least 8 characters with one letter and one number.';
    }
  }
  return '';
}
