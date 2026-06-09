import type { CSSProperties, ReactElement } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import {
  ACCENT,
  body,
  brand,
  button,
  buttonWrap,
  card,
  container,
  footer,
  footerBrand,
  footerText,
  header,
  heading,
  hr,
  paragraph,
} from "./styles";

export interface ResetPasswordEmailProps {
  /** Link the recipient clicks to set a new password. */
  resetUrl: string;
  /** Optional first name for a personal greeting. */
  firstName?: string;
  /** How long the link stays valid, in minutes — surfaced in the copy. */
  expiresInMinutes?: number;
}

function formatExpiry(minutes?: number): string {
  if (!minutes || minutes <= 0) return "a short while";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

// A React Email template plus the optional `PreviewProps` the React Email dev
// server reads to render a preview with sample data (ignored at runtime).
type EmailTemplate = ((props: ResetPasswordEmailProps) => ReactElement) & {
  PreviewProps?: ResetPasswordEmailProps;
};

export const ResetPasswordEmail: EmailTemplate = ({
  resetUrl,
  firstName,
  expiresInMinutes,
}: ResetPasswordEmailProps) => {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your Lineless password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Lineless</Text>
          </Section>

          <Section style={card}>
            <Heading style={heading}>Reset your password</Heading>
            <Text style={paragraph}>{greeting}</Text>
            <Text style={paragraph}>
              We received a request to reset the password for your Lineless
              account. Click the button below to choose a new one.
            </Text>

            <Section style={buttonWrap}>
              <Button style={button} href={resetUrl}>
                Reset password
              </Button>
            </Section>

            <Text style={expiryNote}>
              This link expires in {formatExpiry(expiresInMinutes)} and can only
              be used once.
            </Text>

            <Hr style={hr} />

            <Text style={fallbackLabel}>
              Button not working? Copy and paste this link into your browser:
            </Text>
            <Link href={resetUrl} style={fallbackLink}>
              {resetUrl}
            </Link>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because a password reset was requested for
              your Lineless account. If this wasn&apos;t you, you can safely
              ignore it — your password won&apos;t change.
            </Text>
            <Text style={footerBrand}>© Lineless</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

ResetPasswordEmail.PreviewProps = {
  resetUrl: "https://example.com/reset-password?token=preview-token",
  firstName: "Robin",
  expiresInMinutes: 60,
};

export default ResetPasswordEmail;

// Reset-specific styles; shared visual language lives in ./styles.
const expiryNote: CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
  textAlign: "center",
};

const fallbackLabel: CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 6px",
};

const fallbackLink: CSSProperties = {
  color: ACCENT,
  fontSize: "12px",
  lineHeight: "18px",
  wordBreak: "break-all",
};
