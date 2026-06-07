import { readRequiredStringClaim, verifyJwt } from "../../lib/jwt";

// Verifies an organizer JWT and returns the authenticated account.
export function authenticateOrganizerToken(token: string): {
  accountId: string;
} {
  const payload = verifyJwt(token);
  if (payload["tokenType"] !== "ORGANIZER") {
    throw new Error("Invalid organizer token payload");
  }

  return { accountId: readRequiredStringClaim(payload, "sub") };
}
