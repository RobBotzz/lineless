export function readJsonFromStorage(key: string): unknown {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJsonToStorage(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}
