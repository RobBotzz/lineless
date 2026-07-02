import { getResend } from "./client";
import { config } from "../../config/config";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import {
  OrderCreatedEmail,
  type OrderCreatedEmailStandGroup,
} from "./templates/OrderCreatedEmail";

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

export interface SendOrderCreatedEmailParams {
  to: string;
  orderNumber: string;
  eventName: string;
  stands: OrderCreatedEmailStandGroup[];
  totalCents: number;
  trackOrderUrl: string;
}

// "Order placed, payment pending" mail for unpaid cash orders. Renders the
// template and sends it via Resend. Throws on a Resend error so callers can
// decide how to handle delivery failures.
export async function sendOrderCreatedEmail({
  to,
  orderNumber,
  eventName,
  stands,
  totalCents,
  trackOrderUrl,
}: SendOrderCreatedEmailParams): Promise<void> {
  const { error } = await getResend().emails.send({
    from: config.resend.fromAddress,
    to,
    subject: `Order ${orderNumber} placed — payment pending`,
    react: (
      <OrderCreatedEmail
        orderNumber={orderNumber}
        eventName={eventName}
        stands={stands}
        totalCents={totalCents}
        trackOrderUrl={trackOrderUrl}
      />
    ),
  });

  if (error) {
    throw new Error(
      `Resend failed to send order-created email: ${error.message}`
    );
  }
}
