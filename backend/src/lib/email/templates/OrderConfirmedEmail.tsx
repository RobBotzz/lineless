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
  paragraph,
} from "./styles";
import {
  OrderMetaCards,
  ProductsByStand,
  type OrderEmailStandGroup,
} from "./orderEmailShared";

export interface OrderConfirmedEmailProps {
  /** Human-friendly order number, e.g. "A041". */
  orderNumber: string;
  /** Name of the event the order belongs to. */
  eventName: string;
  /** Code the attendee shows at the stand to collect the order. */
  pickupCode: string;
  /** Ordered items grouped by the stand that prepares them. */
  stands: OrderEmailStandGroup[];
  /** Order total including tax, in integer cents. */
  totalCents: number;
  /** Deep link into the attendee webview that tracks this order. */
  trackOrderUrl: string;
}

const confirmedCard: CSSProperties = {
  backgroundColor: "#ecfdf5",
  border: "1px solid #bbe8d2",
  borderRadius: "14px",
  margin: "0 0 16px",
  padding: "24px 20px",
  textAlign: "center",
};

const confirmedTitle: CSSProperties = {
  color: "#1f2937",
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 6px",
};

const confirmedSubtext: CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
};

// A React Email template plus the optional `PreviewProps` the React Email dev
// server reads to render a preview with sample data (ignored at runtime).
type EmailTemplate = ((props: OrderConfirmedEmailProps) => ReactElement) & {
  PreviewProps?: OrderConfirmedEmailProps;
};

export const OrderConfirmedEmail: EmailTemplate = ({
  orderNumber,
  eventName,
  pickupCode,
  stands,
  totalCents,
  trackOrderUrl,
}: OrderConfirmedEmailProps) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Order {orderNumber} is paid — your pickup code is {pickupCode}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>lineless</Text>
          </Section>

          <Section style={confirmedCard}>
            <Text style={confirmedTitle}>Payment Confirmed</Text>
            <Text style={confirmedSubtext}>
              Your order at {eventName} is paid and will be prepared. Keep your
              pickup code ready when you collect it.
            </Text>
          </Section>

          <OrderMetaCards orderNumber={orderNumber} pickupCode={pickupCode} />

          <Section style={{ ...card, marginTop: "16px" }}>
            <ProductsByStand stands={stands} totalCents={totalCents} />

            <Section style={buttonWrap}>
              <Button style={button} href={trackOrderUrl}>
                Track your order
              </Button>
            </Section>

            <Text style={paragraph}>
              Follow the live status of your order on this page — it shows you
              when each item is ready for pickup.
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

OrderConfirmedEmail.PreviewProps = {
  orderNumber: "A041",
  eventName: "Sommerfest",
  pickupCode: "1DA2",
  stands: [
    {
      standName: "Drinks",
      items: [
        {
          name: "Augustiner Helles (0,5 L)",
          quantity: 2,
          unitPriceCents: 550,
          imageUrl: null,
        },
      ],
    },
  ],
  totalCents: 1100,
  trackOrderUrl: "https://example.com/event/evt/orders/ord",
};

export default OrderConfirmedEmail;
