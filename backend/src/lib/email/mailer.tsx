import { getResend } from "./client";
import { config } from "../../config/config";
import { ResetPasswordEmail } from "./templates/ResetPasswordEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { OrderCreatedEmail } from "./templates/OrderCreatedEmail";
import { OrderConfirmedEmail } from "./templates/OrderConfirmedEmail";
import type { OrderEmailStandGroup } from "./templates/orderEmailShared";

// "Display Name <address>" — the display name is what recipient inboxes show
// as the sender; it lives in the from header, not in the domain config.
const FROM = `Lineless <${config.resend.fromAddress}>`;

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
    from: FROM,
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
    from: FROM,
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
  stands: OrderEmailStandGroup[];
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
    from: FROM,
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

export interface SendOrderConfirmedEmailParams {
  to: string;
  orderNumber: string;
  eventName: string;
  pickupCode: string;
  stands: OrderEmailStandGroup[];
  totalCents: number;
  trackOrderUrl: string;
}

// "Order paid" confirmation with the now-available pickup code. Sent for card
// orders right away and for cash orders once the cashier confirms payment.
// Throws on a Resend error so callers can decide how to handle failures.
export async function sendOrderConfirmedEmail({
  to,
  orderNumber,
  eventName,
  pickupCode,
  stands,
  totalCents,
  trackOrderUrl,
}: SendOrderConfirmedEmailParams): Promise<void> {
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: `Order ${orderNumber} confirmed — pickup code ${pickupCode}`,
    react: (
      <OrderConfirmedEmail
        orderNumber={orderNumber}
        eventName={eventName}
        pickupCode={pickupCode}
        stands={stands}
        totalCents={totalCents}
        trackOrderUrl={trackOrderUrl}
      />
    ),
  });

  if (error) {
    throw new Error(
      `Resend failed to send order-confirmed email: ${error.message}`
    );
  }
}
