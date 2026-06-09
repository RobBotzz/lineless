import { getResend } from "./client";
import { config } from "../../config/config";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  firstName?: string;
  expiresInMinutes?: number;
}

// Renders the React template and sends it via Resend. Throws on a Resend error
// so callers can decide how to handle delivery failures.
export async function sendPasswordResetEmail({
  to,
  resetUrl,
  firstName,
  expiresInMinutes,
}: SendPasswordResetEmailParams): Promise<void> {
  const { error } = await getResend().emails.send({
    from: config.resend.fromAddress,
    to,
    subject: "Reset your Lineless password",
    react: (
      <ResetPasswordEmail
        resetUrl={resetUrl}
        firstName={firstName}
        expiresInMinutes={expiresInMinutes}
      />
    ),
  });

  if (error) {
    throw new Error(`Resend failed to send reset email: ${error.message}`);
  }
}

export interface SendWelcomeEmailParams {
  to: string;
  firstName?: string;
  dashboardUrl: string;
}

// Renders the welcome template and sends it via Resend. Throws on a Resend
// error so callers can decide how to handle delivery failures.
export async function sendWelcomeEmail({
  to,
  firstName,
  dashboardUrl,
}: SendWelcomeEmailParams): Promise<void> {
  const { error } = await getResend().emails.send({
    from: config.resend.fromAddress,
    to,
    subject: "Welcome to Lineless",
    react: <WelcomeEmail firstName={firstName} dashboardUrl={dashboardUrl} />,
  });

  if (error) {
    throw new Error(`Resend failed to send welcome email: ${error.message}`);
  }
}
