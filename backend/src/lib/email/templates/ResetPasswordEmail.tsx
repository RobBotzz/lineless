import type { CSSProperties } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface ResetPasswordEmailProps {
  /** Link the recipient clicks to set a new password. */
  resetUrl: string;
  /** Optional first name for a personal greeting. */
  firstName?: string;
}

export function ResetPasswordEmail({
  resetUrl,
  firstName,
}: ResetPasswordEmailProps) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return (
    <Html>
      <Head />
      <Preview>Reset your Lineless password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Reset your password</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We received a request to reset the password for your Lineless
            account. Click the button below to choose a new one. This link will
            expire shortly for your security.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={resetUrl}>
              Reset password
            </Button>
          </Section>
          <Text style={muted}>
            If you didn&apos;t request this, you can safely ignore this email —
            your password won&apos;t change.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPasswordEmail;

const body: CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "24px 0",
};

const container: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const heading: CSSProperties = {
  color: "#1e1e1e",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 16px",
};

const text: CSSProperties = {
  color: "#3f3f46",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 12px",
};

const buttonSection: CSSProperties = {
  margin: "24px 0",
  textAlign: "center",
};

const button: CSSProperties = {
  backgroundColor: "#020887",
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const muted: CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "16px 0 0",
};
