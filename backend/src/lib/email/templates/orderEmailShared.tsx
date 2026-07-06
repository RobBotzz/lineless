import type { CSSProperties, ReactElement } from "react";
import { Column, Img, Row, Section, Text } from "@react-email/components";

// Building blocks shared by the order lifecycle emails (created / confirmed),
// mirroring the attendee webview: meta cards for order number & pickup code and
// the "Products by Stand" list with quantity rows.

export interface OrderEmailItem {
  /** Product name at the time of ordering. */
  name: string;
  /** Number of units ordered. */
  quantity: number;
  /** Unit price including tax, in integer cents. */
  unitPriceCents: number;
  /** Absolute product image URL, or null when the product has no image. */
  imageUrl: string | null;
}

export interface OrderEmailStandGroup {
  standName: string;
  items: OrderEmailItem[];
}

// Matches the webview's money format: "EUR 35.50".
export function formatEur(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export const ACCENT = "#020887";

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

const metaValueGreen: CSSProperties = {
  color: "#16a34a",
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

export interface OrderMetaCardsProps {
  orderNumber: string;
  /** The pickup code once the order is paid; null renders "Available after payment". */
  pickupCode: string | null;
}

// The two side-by-side cards under the status banner: order number (accent) and
// pickup code (green once available, muted placeholder before payment).
export function OrderMetaCards({
  orderNumber,
  pickupCode,
}: OrderMetaCardsProps): ReactElement {
  return (
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
          {pickupCode ? (
            <Text style={metaValueGreen}>{pickupCode}</Text>
          ) : (
            <Text style={metaValueMuted}>Available after payment</Text>
          )}
        </Section>
      </Column>
    </Row>
  );
}

export interface ProductsByStandProps {
  stands: OrderEmailStandGroup[];
  totalCents: number;
}

// The "Products by Stand" list: stand headers, quantity rows with line totals
// and unit prices, and the total amount row.
export function ProductsByStand({
  stands,
  totalCents,
}: ProductsByStandProps): ReactElement {
  return (
    <>
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
                    {item.quantity} x {formatEur(item.unitPriceCents)}
                  </Text>
                </Column>
                <Column>
                  <Text style={itemTotal}>
                    {formatEur(item.quantity * item.unitPriceCents)}
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
    </>
  );
}
