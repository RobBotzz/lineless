import type { ReactElement } from "react";
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
import {
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
  paragraph,
} from "./styles";

export interface WelcomeEmailProps {
  /** Optional first name for a personal greeting. */
  firstName?: string;
  /** Link to the organizer dashboard / app entry point. */
  dashboardUrl: string;
}

// A React Email template plus the optional `PreviewProps` the React Email dev
// server reads to render a preview with sample data (ignored at runtime).
type EmailTemplate = ((props: WelcomeEmailProps) => ReactElement) & {
  PreviewProps?: WelcomeEmailProps;
};

export const WelcomeEmail: EmailTemplate = ({
  firstName,
  dashboardUrl,
}: WelcomeEmailProps) => {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Lineless — your account is ready</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Lineless</Text>
          </Section>

          <Section style={card}>
            <Heading style={heading}>Welcome to Lineless</Heading>
            <Text style={paragraph}>{greeting}</Text>
            <Text style={paragraph}>
              Your account is ready. You can now create events, set up stands and
              products, and start taking orders — all from your dashboard.
            </Text>

            <Section style={buttonWrap}>
              <Button style={button} href={dashboardUrl}>
                Go to your dashboard
              </Button>
            </Section>

            <Text style={paragraph}>
              Need a hand getting started? Just reply to this email and we&apos;ll
              help you out.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because an account was created with this
              address on Lineless. If this wasn&apos;t you, please contact us.
            </Text>
            <Text style={footerBrand}>© Lineless</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

WelcomeEmail.PreviewProps = {
  firstName: "Robin",
  dashboardUrl: "https://example.com/organizer",
};

export default WelcomeEmail;
