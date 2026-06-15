// Locale time-of-day, e.g. "10:11:15 PM".
export function formatOrderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

// Locale time + date, e.g. "10:11:15 PM - 5/17/2026".
export function formatOrderDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleTimeString()} - ${date.toLocaleDateString()}`;
}
