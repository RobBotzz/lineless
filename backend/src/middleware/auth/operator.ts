import { readRequiredStringClaim, verifyJwt } from "../../lib/jwt";

// Verifies a stand-scoped operator JWT and returns the authenticated stand.
export function authenticateOperatorToken(token: string): { standId: string } {
  const payload = verifyJwt(token);
  if (payload["tokenType"] !== "OPERATOR") {
    throw new Error("Invalid operator token payload");
  }

  return { standId: readRequiredStringClaim(payload, "standId") };
}
