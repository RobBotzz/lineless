import { Resend } from "resend";
import { config } from "../../config/config";

// Lazily created so the server still boots when no Resend API key is configured
// (the Resend constructor throws on an empty key). Mail sends then fail at call
// time and are handled by the caller, rather than crashing the app on startup.
let client: Resend | null = null;

export function getResend(): Resend {
  if (!config.resend.apiKey) {
    throw new Error("Resend is not configured (missing RESEND_API_KEY)");
  }
  client ??= new Resend(config.resend.apiKey);
  return client;
}
