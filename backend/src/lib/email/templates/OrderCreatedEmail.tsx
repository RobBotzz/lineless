import type { CSSProperties, ReactElement } from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
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

export interface OrderCreatedEmailItem {
  /** Product name at the time of ordering. */
  name: string;
  /** Number of units ordered. */
  quantity: number;
  /** Unit price including tax, in integer cents. */
  unitPriceCents: number;
  /** Absolute product image URL, or null when the product has no image. */
  imageUrl: string | null;
}

export interface OrderCreatedEmailStandGroup {
  standName: string;
  items: OrderCreatedEmailItem[];
}

export interface OrderCreatedEmailProps {
  /** Human-friendly order number, e.g. "A041". */
  orderNumber: string;
  /** Name of the event the order belongs to. */
  eventName: string;
  /** Ordered items grouped by the stand that prepares them. */
  stands: OrderCreatedEmailStandGroup[];
  /** Order total including tax, in integer cents. */
  totalCents: number;
  /** Deep link into the attendee webview that tracks this order. */
  trackOrderUrl: string;
}

// Matches the webview's money format: "EUR 35.50".
function formatEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

const ACCENT = "#020887";

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

const metaCard: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "16px 18px",
};

const metaLabel: CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "18px",
  margin: "0 0 4px",
};

const metaValueAccent: CSSProperties = {
  color: ACCENT,
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

const metaValueMuted: CSSProperties = {
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "18px",
  margin: 0,
};

const sectionTitle: CSSProperties = {
  color: "#0f172a",
  fontSize: "17px",
  fontWeight: 700,
  margin: "0 0 14px",
};

const standHeader: CSSProperties = {
  borderLeft: `3px solid ${ACCENT}`,
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: 700,
  margin: "0 0 8px",
  paddingLeft: "10px",
};

const itemRow: CSSProperties = {
  backgroundColor: "#f1f5f9",
  borderRadius: "10px",
  margin: "0 0 8px",
  padding: "10px 14px",
};

const itemImageColumn: CSSProperties = {
  paddingRight: "12px",
  verticalAlign: "middle",
  width: "44px",
};

const itemImage: CSSProperties = {
  borderRadius: "8px",
  display: "block",
  height: "44px",
  objectFit: "cover",
  width: "44px",
};

const itemName: CSSProperties = {
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "20px",
  margin: 0,
};

const itemQuantity: CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};

const itemTotal: CSSProperties = {
  color: ACCENT,
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "20px",
  margin: 0,
  textAlign: "right",
};

const itemUnitPrice: CSSProperties = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
  textAlign: "right",
};

const totalRow: CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  marginTop: "14px",
  paddingTop: "14px",
};

const totalLabel: CSSProperties = {
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
};

const totalValue: CSSProperties = {
  color: ACCENT,
  fontSize: "16px",
  fontWeight: 700,
  margin: 0,
  textAlign: "right",
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

          <Row>
            <Column style={{ paddingRight: "6px", width: "50%" }}>
              <Section style={metaCard}>
                <Text style={metaLabel}>Order Number</Text>
                <Text style={metaValueAccent}>{orderNumber}</Text>
              </Section>
            </Column>
            <Column style={{ paddingLeft: "6px", width: "50%" }}>
              <Section style={metaCard}>
                <Text style={metaLabel}>Pickup Code</Text>
                <Text style={metaValueMuted}>Available after payment</Text>
              </Section>
            </Column>
          </Row>

          <Section style={{ ...card, marginTop: "16px" }}>
            <Text style={sectionTitle}>Products by Stand</Text>

            {stands.map((stand) => (
              <Section key={stand.standName} style={{ margin: "0 0 14px" }}>
                <Text style={standHeader}>{stand.standName}</Text>
                {stand.items.map((item, index) => (
                  <Section key={index} style={itemRow}>
                    <Row>
                      {item.imageUrl ? (
                        <Column style={itemImageColumn}>
                          <Img
                            src={item.imageUrl}
                            alt={item.name}
                            width="44"
                            height="44"
                            style={itemImage}
                          />
                        </Column>
                      ) : null}
                      <Column>
                        <Text style={itemName}>{item.name}</Text>
                        <Text style={itemQuantity}>
                          Quantity: {item.quantity}
                        </Text>
                      </Column>
                      <Column>
                        <Text style={itemTotal}>
                          {formatEur(item.quantity * item.unitPriceCents)}
                        </Text>
                        <Text style={itemUnitPrice}>
                          {formatEur(item.unitPriceCents)} / pc
                        </Text>
                      </Column>
                    </Row>
                  </Section>
                ))}
              </Section>
            ))}

            <Row style={totalRow}>
              <Column>
                <Text style={totalLabel}>Total Amount</Text>
              </Column>
              <Column>
                <Text style={totalValue}>{formatEur(totalCents)}</Text>
              </Column>
            </Row>

            <Section style={buttonWrap}>
              <Button style={button} href={trackOrderUrl}>
                Track your order
              </Button>
            </Section>

            <Text style={paragraph}>
              Once you have paid, this page will show your pickup code and the
              live status of your order.
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
