import { resend } from "./client";
import { config } from "../../config/config";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  firstName?: string;
}

// Renders the React template and sends it via Resend. Throws on a Resend error
// so callers can decide how to handle delivery failures.
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  firstName,
}: SendPasswordResetEmailParams): Promise<void> {
  const { error } = await resend.emails.send({
    from: config.resend.fromAddress,
    to,
    subject: "Reset your Lineless password",
    react: <ResetPasswordEmail resetUrl={resetUrl} firstName={firstName} />,
  });

  if (error) {
    throw new Error(`Resend failed to send reset email: ${error.message}`);
  }
}
