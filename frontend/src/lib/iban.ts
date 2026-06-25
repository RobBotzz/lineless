// IBAN validation per ISO 13616 + the ISO 7064 MOD-97-10 checksum. Mirrors the
// backend check (src/shared/iban.ts) for instant feedback; the backend remains
// authoritative. The remainder is reduced digit by digit so a 30+ digit IBAN
// never overflows Number precision.

const IBAN_STRUCTURE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (iban.length < 15 || iban.length > 34) return false;
  if (!IBAN_STRUCTURE.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const piece = code >= 65 && code <= 90 ? String(code - 55) : char;
    for (const digit of piece) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}
