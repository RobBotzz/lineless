import type { CSSProperties, ReactElement } from "react";
import {
  Body,
  Button,
  Container,
  Head,
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
  hint,
  paragraph,
} from "./styles";
import {
  OrderMetaCards,
  ProductsByStand,
  type OrderEmailStandGroup,
} from "./orderEmailShared";

export interface OrderCreatedEmailProps {
  /** Human-friendly order number, e.g. "A041". */
  orderNumber: string;
  /** Name of the event the order belongs to. */
  eventName: string;
  /** Ordered items grouped by the stand that prepares them. */
  stands: OrderEmailStandGroup[];
  /** Order total including tax, in integer cents. */
  totalCents: number;
  /** Deep link into the attendee webview that tracks this order. */
  trackOrderUrl: string;
}

const pendingCard: CSSProperties = {
  backgroundColor: "#fdf1e3",
  border: "1px solid #f5ddc0",
  borderRadius: "14px",
  margin: "0 0 16px",
  padding: "24px 20px",
  textAlign: "center",
};

const pendingTitle: CSSProperties = {
  color: "#1f2937",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 6px",
};

const pendingSubtext: CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
};

// A React Email template plus the optional `PreviewProps` the React Email dev
// server reads to render a preview with sample data (ignored at runtime).
type EmailTemplate = ((props: OrderCreatedEmailProps) => ReactElement) & {
  PreviewProps?: OrderCreatedEmailProps;
};

export const OrderCreatedEmail: EmailTemplate = ({
  orderNumber,
  eventName,
  stands,
  totalCents,
  trackOrderUrl,
}: OrderCreatedEmailProps) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Order {orderNumber} placed — please pay at the cashier to get it started
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>lineless</Text>
          </Section>

          <Section style={pendingCard}>
            <Text style={pendingTitle}>Payment Pending</Text>
            <Text style={pendingSubtext}>
              Please go to the cashier to pay for your order at {eventName}. It
              will only be prepared once it has been paid.
            </Text>
          </Section>

          <OrderMetaCards orderNumber={orderNumber} pickupCode={null} />

          <Section style={{ ...card, marginTop: "16px" }}>
            <ProductsByStand stands={stands} totalCents={totalCents} />

            <Section style={buttonWrap}>
              <Button style={button} href={trackOrderUrl}>
                Track your order
              </Button>
            </Section>

            <Text style={paragraph}>
              Once you have paid, this page will show your pickup code and the
              live status of your order.
            </Text>

            <Text style={hint}>
              Please open this link on the same device and browser you ordered
              from — your order is saved there, so the link won&apos;t open it
              elsewhere.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because this address was provided for
              order updates at a Lineless event. If this wasn&apos;t you, you
              can ignore this email.
            </Text>
            <Text style={footerBrand}>© Lineless</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

OrderCreatedEmail.PreviewProps = {
  orderNumber: "A041",
  eventName: "Sommerfest",
  stands: [
    {
      standName: "Drinks",
      items: [
        {
          name: "Geile Säue",
          quantity: 2,
          unitPriceCents: 1000,
          imageUrl: null,
        },
        {
          name: "Augustiner Helles (0,5 L)",
          quantity: 1,
          unitPriceCents: 550,
          imageUrl: null,
        },
      ],
    },
    {
      standName: "Grill",
      items: [
        {
          name: "Bratwurst",
          quantity: 1,
          unitPriceCents: 350,
          imageUrl: "https://example.com/bratwurst.jpg",
        },
      ],
    },
  ],
  totalCents: 2900,
  trackOrderUrl: "https://example.com/event/evt/orders/ord",
};

export default OrderCreatedEmail;
