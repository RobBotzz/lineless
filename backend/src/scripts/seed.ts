/**
 * Idempotent demo seed for the "MPIC Sommerfest" event.
 *
 * Run manually against a LOCAL MongoDB:
 *
 *   npm run db:up      # start the local replica-set Mongo (if not running)
 *   npm run db:seed    # (re-)populate the demo data
 *
 * Safe to run repeatedly: every document uses a deterministic id derived from a
 * fixed namespace, and the script first purges everything tied to the demo
 * event/account, then rebuilds it. Nothing outside the demo event is touched.
 */
import path from "path";
import fs from "fs";
import { v5 as uuidv5 } from "uuid";

import { connectDB, disconnectDB } from "../lib/db";
import { hashPassword } from "../lib/password";
import { sniffImageMimeType } from "../shared/imageUpload";
import { config } from "../config/config";

import { Account } from "../modules/accounts/model";
import { Event } from "../modules/events/model";
import { EventLogo } from "../modules/events/logo.model";
import { Stand } from "../modules/stands/model";
import {
  Product,
  type ProductStatus,
  type StockMode,
} from "../modules/products/model";
import { ProductImage } from "../modules/products/image.model";
import { AttendeeSession } from "../modules/sessions/model";
import { Tab } from "../modules/tabs/model";
import { TabPayment } from "../modules/payments/model";
import {
  Order,
  type OrderItemDoc,
  type InventoryState,
} from "../modules/orders/model";
import { Rating } from "../modules/ratings/model";
import { Payout } from "../modules/payouts/model";

// ---------------------------------------------------------------------------
// Deterministic ids
// ---------------------------------------------------------------------------

// Fixed namespace so every re-run produces the exact same ids (idempotency).
const NAMESPACE = "6f1d7c2e-0b4a-4e2a-9c3d-2f8a1b6e5d40";
const id = (label: string): string => uuidv5(label, NAMESPACE);

// ---------------------------------------------------------------------------
// Credentials (documented in the final summary)
// ---------------------------------------------------------------------------

const ORGANIZER_EMAIL = "orga@mpic-fachschaft.de";
const ORGANIZER_PASSWORD = "Sommerfest2026!";
const CASHIER_STAND_PASSWORD = "cashier2026";

const ACCOUNT_ID = id("account:mpic");
const EVENT_ID = id("event:sommerfest");
const OPERATOR_ACCESS_KEY = id("operator-access-key:sommerfest");

// ---------------------------------------------------------------------------
// Time helpers (a live event that started ~3h ago)
// ---------------------------------------------------------------------------

const NOW = new Date();
const minsAgo = (m: number): Date => new Date(NOW.getTime() - m * 60_000);
const daysFromNow = (d: number): Date =>
  new Date(NOW.getTime() + d * 24 * 60 * 60_000);

// ---------------------------------------------------------------------------
// Catalog definition
// ---------------------------------------------------------------------------

interface ProductSpec {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  taxRateBp: number;
  stockMode: StockMode;
  initialStock: number; // meaningful only for TRACKED
  status: ProductStatus;
  instant: boolean;
}

interface StandSpec {
  slug: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  products: ProductSpec[];
}

const FOOD_TAX = 700; // 7% reduced VAT (food)
const DRINK_TAX = 1900; // 19% standard VAT (drinks/alcohol)

// Event site — every stand sits within a few tens of metres of this point.
// Location convention (see frontend src/types/location.ts): xCoordinate =
// longitude, yCoordinate = latitude (WGS84).
const BASE_LAT = 48.26367692343579;
const BASE_LNG = 11.667027856313153;

const STANDS: StandSpec[] = [
  {
    slug: "grill-bbq",
    name: "Grill & BBQ",
    locationName: "Courtyard — north side",
    lat: BASE_LAT + 0.0004,
    lng: BASE_LNG + 0.0002,
    products: [
      {
        slug: "bratwurst",
        name: "Bratwurstsemmel",
        description: "Grilled pork sausage in a fresh bun with mustard.",
        priceCents: 350,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 40,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "steak-sandwich",
        name: "Steaksemmel",
        description: "Crusty roll with grilled steak strips, onions and aioli.",
        priceCents: 690,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 25,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "veggie-burger",
        name: "Veggie Burger",
        description: "House bean patty, salad and smoked-paprika sauce.",
        priceCents: 590,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 20,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "grilled-corn",
        name: "Grilled Corn",
        description: "Charred corn on the cob brushed with herb butter.",
        priceCents: 300,
        taxRateBp: FOOD_TAX,
        stockMode: "UNLIMITED",
        initialStock: 0,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "bavarian-pretzel",
        name: "Breze",
        description: "Freshly baked soft pretzel with coarse salt.",
        priceCents: 250,
        taxRateBp: FOOD_TAX,
        stockMode: "UNLIMITED",
        initialStock: 0,
        status: "LIVE",
        instant: true,
      },
    ],
  },
  {
    slug: "drinks-bar",
    name: "Drinks & Bar",
    locationName: "Main lawn — beer tent",
    lat: BASE_LAT - 0.0003,
    lng: BASE_LNG + 0.0004,
    products: [
      {
        slug: "augustiner-helles",
        name: "Augustiner Helles (0.5L)",
        description: "Munich's classic pale lager, served ice-cold.",
        priceCents: 450,
        taxRateBp: DRINK_TAX,
        stockMode: "TRACKED",
        initialStock: 120,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "paulaner-helles",
        name: "Paulaner Helles (0.5L)",
        description: "Smooth Munich pale lager with a gentle malty finish.",
        priceCents: 450,
        taxRateBp: DRINK_TAX,
        stockMode: "TRACKED",
        initialStock: 60,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "cola",
        name: "Cola (0.33L)",
        description: "Chilled classic cola.",
        priceCents: 280,
        taxRateBp: DRINK_TAX,
        stockMode: "UNLIMITED",
        initialStock: 0,
        status: "LIVE",
        instant: true,
      },
      {
        slug: "still-water",
        name: "Still Water (0.5L)",
        description: "Still mineral water.",
        priceCents: 220,
        taxRateBp: DRINK_TAX,
        stockMode: "UNLIMITED",
        initialStock: 0,
        status: "LIVE",
        instant: true,
      },
      {
        slug: "aperol-spritz",
        name: "Aperol Spritz",
        description: "Aperol, prosecco and soda over ice.",
        priceCents: 690,
        taxRateBp: DRINK_TAX,
        stockMode: "TRACKED",
        initialStock: 30,
        status: "PAUSED",
        instant: false,
      },
    ],
  },
  {
    slug: "sweets-coffee",
    name: "Sweets & Coffee",
    locationName: "Terrace — east side",
    lat: BASE_LAT + 0.0002,
    lng: BASE_LNG - 0.0004,
    products: [
      {
        slug: "belgian-waffle",
        name: "Belgian Waffle",
        description: "Warm waffle with powdered sugar and berry compote.",
        priceCents: 480,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 35,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "ice-cream-cup",
        name: "Ice Cream Cup",
        description: "Two scoops of vanilla and chocolate gelato.",
        priceCents: 320,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 50,
        status: "LIVE",
        instant: false,
      },
      {
        slug: "filter-coffee",
        name: "Filter Coffee",
        description: "Freshly brewed fair-trade filter coffee.",
        priceCents: 250,
        taxRateBp: FOOD_TAX,
        stockMode: "UNLIMITED",
        initialStock: 0,
        status: "PAUSED",
        instant: false,
      },
      {
        slug: "iced-latte",
        name: "Iced Latte",
        description: "Espresso over milk and ice.",
        priceCents: 390,
        taxRateBp: FOOD_TAX,
        stockMode: "TRACKED",
        initialStock: 40,
        status: "LIVE",
        instant: false,
      },
    ],
  },
];

const CASHIER_STAND = {
  slug: "cash-desk",
  name: "Cash Desk",
  locationName: "Entrance — info point",
  lat: BASE_LAT,
  lng: BASE_LNG,
};

// ---------------------------------------------------------------------------
// Attendees
// ---------------------------------------------------------------------------

interface AttendeeSpec {
  slug: string;
  name: string;
  email: string | null;
}

const ATTENDEES: AttendeeSpec[] = [
  { slug: "andi", name: "Andi", email: "andi@example.com" },
  { slug: "bella", name: "Bella", email: "bella@example.com" },
  { slug: "chris", name: "Chris", email: "chris@example.com" },
  { slug: "dana", name: "Dana", email: "dana@example.com" },
  { slug: "ewan", name: "Ewan", email: null },
  { slug: "farah", name: "Farah", email: "farah@example.com" },
  { slug: "gabriel", name: "Gabriel", email: "gabriel@example.com" },
  { slug: "hana", name: "Hana", email: null },
  { slug: "ivan", name: "Ivan", email: "ivan@example.com" },
  { slug: "julia", name: "Julia", email: "julia@example.com" },
  { slug: "kwame", name: "Kwame", email: "kwame@example.com" },
  { slug: "lena", name: "Lena", email: "lena@example.com" },
];

// ---------------------------------------------------------------------------
// Runtime lookups populated while building
// ---------------------------------------------------------------------------

const productBySlug = new Map<
  string,
  ProductSpec & { _id: string; standId: string; stock: number }
>();

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

const ASSETS_DIR = path.resolve(__dirname, "../../seed-assets");
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

// Returns the first matching image file for a base path (without extension), or
// null if none exists / the bytes are not a supported image.
function loadImage(
  baseNoExt: string
): { data: Buffer; contentType: string } | null {
  for (const ext of IMAGE_EXTS) {
    const file = baseNoExt + ext;
    if (!fs.existsSync(file)) continue;
    const data = fs.readFileSync(file);
    const contentType = sniffImageMimeType(data);
    if (!contentType) {
      console.warn(`  ! ${path.basename(file)} is not a valid image — skipped`);
      return null;
    }
    return { data, contentType };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Order building
// ---------------------------------------------------------------------------

type ItemState = "pending" | "preparing" | "ready" | "fulfilled" | "cancelled";

interface ItemSpec {
  product: string; // slug
  state: ItemState;
  comment?: string;
  rating?: { stars: number; comment: string | null };
}

interface OrderSpec {
  key: string;
  channel: "cash" | "card";
  attendee: string | null; // slug; null = cashier-created cash order
  tab?: string; // tab slug for card orders
  createdMinsAgo: number;
  items: ItemSpec[];
  refundCents?: number; // a cash refund already issued on this order
  unpaid?: boolean; // cash order still awaiting the cashier to confirm payment
}

let orderSeq = 0;
const orderDocs: Record<string, unknown>[] = [];
const ratingDocs: Record<string, unknown>[] = [];
// Accumulated rating aggregates per product id.
const ratingAgg = new Map<string, { sum: number; count: number }>();

function pickupCode(n: number): string {
  return (0x1000 + n).toString(16).toUpperCase();
}

// Maps an item state + product to the timestamp fields and inventory bookkeeping.
function buildItem(
  spec: ItemSpec,
  orderId: string,
  createdAt: Date,
  attendeeSessionId: string | null,
  eventId: string
): OrderItemDoc {
  const product = productBySlug.get(spec.product);
  if (!product) throw new Error(`Unknown product slug: ${spec.product}`);

  const tracked = product.stockMode === "TRACKED";
  let inventoryState: InventoryState = tracked ? "RESERVED" : "UNTRACKED";

  let startedAt: Date | null = null;
  let readyAt: Date | null = null;
  let fulfilledAt: Date | null = null;
  let cancelledAt: Date | null = null;

  const t0 = createdAt.getTime();
  switch (spec.state) {
    case "pending":
      break;
    case "preparing":
      startedAt = new Date(t0 + 2 * 60_000);
      if (tracked) inventoryState = "CONSUMED";
      break;
    case "ready":
      startedAt = new Date(t0 + 2 * 60_000);
      readyAt = new Date(t0 + 6 * 60_000);
      if (tracked) inventoryState = "CONSUMED";
      break;
    case "fulfilled":
      startedAt = new Date(t0 + 2 * 60_000);
      readyAt = new Date(t0 + 6 * 60_000);
      fulfilledAt = new Date(t0 + 10 * 60_000);
      if (tracked) inventoryState = "CONSUMED";
      break;
    case "cancelled":
      // Cancelled from PENDING: the reservation is released and stock returns.
      cancelledAt = new Date(t0 + 3 * 60_000);
      if (tracked) inventoryState = "RELEASED";
      break;
  }

  // Instant products are handed over immediately, so any delivered instant item
  // has startedAt === readyAt (mirrors releaseInstantItems).
  if (product.instant && startedAt && !readyAt) readyAt = startedAt;

  // Stock bookkeeping: RESERVED and CONSUMED both hold a unit; RELEASED and
  // UNTRACKED do not.
  if (
    tracked &&
    (inventoryState === "RESERVED" || inventoryState === "CONSUMED")
  ) {
    product.stock = Math.max(0, product.stock - 1);
  }

  // A fulfilled item on a rating-enabled event may carry a guest review.
  if (spec.rating && fulfilledAt && attendeeSessionId) {
    ratingDocs.push({
      _id: id(`rating:${orderId}:${product._id}`),
      orderId,
      productId: product._id,
      eventId,
      sessionId: attendeeSessionId,
      stars: spec.rating.stars,
      comment: spec.rating.comment,
      createdAt: new Date(fulfilledAt.getTime() + 5 * 60_000),
      updatedAt: new Date(fulfilledAt.getTime() + 5 * 60_000),
    });
    const agg = ratingAgg.get(product._id) ?? { sum: 0, count: 0 };
    agg.sum += spec.rating.stars;
    agg.count += 1;
    ratingAgg.set(product._id, agg);
  }

  return {
    _id: id(`item:${orderId}:${product._id}:${spec.state}`),
    productId: product._id,
    customerComment: spec.comment ?? null,
    startedAt,
    readyAt,
    fulfilledAt,
    cancelledAt,
    inventoryState,
    priceIncludingTaxAtPurchase: product.priceCents,
    taxRateAtPurchase: product.taxRateBp,
  };
}

function buildOrder(spec: OrderSpec): void {
  orderSeq += 1;
  const orderId = id(`order:${spec.key}`);
  const createdAt = minsAgo(spec.createdMinsAgo);

  const attendee = spec.attendee
    ? ATTENDEES.find((a) => a.slug === spec.attendee)
    : null;
  const sessionId = attendee ? id(`session:${attendee.slug}`) : null;
  const customerEmail = attendee?.email ?? null;

  const items = spec.items.map((it) =>
    buildItem(it, orderId, createdAt, sessionId, EVENT_ID)
  );

  const isCard = spec.channel === "card";
  const tabId = isCard && spec.tab ? id(`tab:${spec.tab}`) : null;

  // Cash orders are paid on confirmation; authorized tab orders are marked paid
  // so they show on the operator board. Orders awaiting cash confirmation stay
  // unpaid (paidAt null, no cashPayment) — their stock is still reserved.
  const paidAt = spec.unpaid ? null : createdAt;

  const cashRefunds =
    spec.refundCents && spec.refundCents > 0
      ? [
          {
            _id: id(`refund:${spec.key}`),
            amountCents: spec.refundCents,
            createdAt: new Date(createdAt.getTime() + 20 * 60_000),
          },
        ]
      : [];

  orderDocs.push({
    _id: orderId,
    eventId: EVENT_ID,
    tabId,
    sessionId,
    requestId: id(`req:${spec.key}`),
    orderNumber: `A${String(orderSeq).padStart(3, "0")}`,
    pickupCode: pickupCode(orderSeq),
    customerEmail,
    paidAt,
    deletedAt: null,
    items,
    cashPayment:
      isCard || spec.unpaid ? null : { _id: id(`cash:${spec.key}`), createdAt },
    cashRefunds,
    createdAt,
    updatedAt: createdAt,
  });
}

// ---------------------------------------------------------------------------
// Order + tab data
// ---------------------------------------------------------------------------

// Card tabs: each an OPEN tab with an authorized baseline hold, plus one PAID
// (checked-out) tab whose hold was captured.
interface TabSpec {
  slug: string;
  attendee: string;
  status: "OPEN" | "PAID";
  authorizedCents: number;
  capturedCents: number; // > 0 only for a checked-out tab
}

const TABS: TabSpec[] = [
  {
    slug: "andi",
    attendee: "andi",
    status: "OPEN",
    authorizedCents: 2000,
    capturedCents: 0,
  },
  {
    slug: "julia",
    attendee: "julia",
    status: "OPEN",
    authorizedCents: 1000,
    capturedCents: 0,
  },
  {
    slug: "gabriel",
    attendee: "gabriel",
    status: "OPEN",
    authorizedCents: 3000,
    capturedCents: 0,
  },
  {
    slug: "lena",
    attendee: "lena",
    status: "PAID",
    authorizedCents: 2000,
    capturedCents: 1330,
  },
];

const ORDERS: OrderSpec[] = [
  // --- Cash orders, attendee-placed, various states ---
  {
    key: "c01",
    channel: "cash",
    attendee: "bella",
    createdMinsAgo: 140,
    items: [
      {
        product: "bratwurst",
        state: "fulfilled",
        rating: { stars: 5, comment: "Perfectly grilled, great mustard!" },
      },
      {
        product: "augustiner-helles",
        state: "fulfilled",
        rating: { stars: 4, comment: "Nice and cold." },
      },
    ],
  },
  {
    key: "c02",
    channel: "cash",
    attendee: "chris",
    createdMinsAgo: 130,
    items: [
      {
        product: "veggie-burger",
        state: "fulfilled",
        rating: { stars: 4, comment: "Tasty patty, would order again." },
      },
      { product: "grilled-corn", state: "fulfilled" },
      { product: "cola", state: "fulfilled" },
    ],
  },
  {
    key: "c03",
    channel: "cash",
    attendee: "dana",
    createdMinsAgo: 90,
    items: [
      {
        product: "belgian-waffle",
        state: "ready",
        comment: "Extra berries please",
      },
      { product: "filter-coffee", state: "ready" },
    ],
  },
  {
    key: "c04",
    channel: "cash",
    attendee: "farah",
    createdMinsAgo: 70,
    items: [
      { product: "steak-sandwich", state: "preparing" },
      { product: "paulaner-helles", state: "preparing" },
    ],
  },
  {
    key: "c05",
    channel: "cash",
    attendee: "ivan",
    createdMinsAgo: 25,
    items: [
      { product: "bratwurst", state: "pending" },
      { product: "bratwurst", state: "pending" },
      { product: "augustiner-helles", state: "pending" },
    ],
  },
  {
    key: "c06",
    channel: "cash",
    attendee: "hana",
    createdMinsAgo: 20,
    items: [
      { product: "ice-cream-cup", state: "pending" },
      { product: "still-water", state: "pending" },
    ],
  },
  // --- Cashier-placed cash orders (no attendee session) ---
  {
    key: "c07",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 115,
    items: [
      { product: "augustiner-helles", state: "fulfilled" },
      { product: "augustiner-helles", state: "fulfilled" },
      { product: "bratwurst", state: "fulfilled" },
    ],
  },
  {
    key: "c08",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 55,
    items: [
      { product: "grilled-corn", state: "ready" },
      { product: "cola", state: "ready" },
    ],
  },
  {
    key: "c09",
    channel: "cash",
    attendee: "kwame",
    createdMinsAgo: 45,
    items: [
      {
        product: "iced-latte",
        state: "fulfilled",
        rating: { stars: 5, comment: "Best iced latte at the fest." },
      },
      {
        product: "belgian-waffle",
        state: "fulfilled",
        rating: { stars: 3, comment: "Good, a little sweet for me." },
      },
    ],
  },
  // --- Cash orders with cancelled items (refund-ready) ---
  {
    key: "c10",
    channel: "cash",
    attendee: "andi",
    createdMinsAgo: 100,
    items: [
      {
        product: "steak-sandwich",
        state: "fulfilled",
        rating: { stars: 4, comment: "Juicy and filling." },
      },
      {
        product: "aperol-spritz",
        state: "cancelled",
        comment: "Sold out — cancelled",
      },
    ],
  },
  {
    key: "c11",
    channel: "cash",
    attendee: "lena",
    createdMinsAgo: 80,
    items: [
      { product: "veggie-burger", state: "ready" },
      { product: "paulaner-helles", state: "cancelled" },
    ],
  },
  {
    key: "c12",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 60,
    items: [
      { product: "ice-cream-cup", state: "cancelled" },
      { product: "ice-cream-cup", state: "fulfilled" },
    ],
  },
  // --- Cash orders where a refund was already issued ---
  {
    key: "c13",
    channel: "cash",
    attendee: "ewan",
    createdMinsAgo: 110,
    items: [
      { product: "bratwurst", state: "fulfilled" },
      { product: "augustiner-helles", state: "cancelled" },
    ],
    refundCents: 450, // the cancelled Augustiner Helles was refunded
  },
  {
    key: "c14",
    channel: "cash",
    attendee: "gabriel",
    createdMinsAgo: 95,
    items: [
      { product: "steak-sandwich", state: "cancelled" },
      { product: "grilled-corn", state: "fulfilled" },
    ],
    refundCents: 690, // the cancelled steak sandwich was refunded
  },
  // --- A few more everyday cash orders for volume ---
  {
    key: "c15",
    channel: "cash",
    attendee: "chris",
    createdMinsAgo: 35,
    items: [
      { product: "augustiner-helles", state: "ready" },
      { product: "bratwurst", state: "ready" },
    ],
  },
  {
    key: "c16",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 30,
    items: [
      { product: "cola", state: "fulfilled" },
      { product: "filter-coffee", state: "fulfilled" },
    ],
  },
  {
    key: "c17",
    channel: "cash",
    attendee: "dana",
    createdMinsAgo: 15,
    items: [{ product: "iced-latte", state: "preparing" }],
  },
  {
    key: "c18",
    channel: "cash",
    attendee: "ivan",
    createdMinsAgo: 10,
    items: [
      { product: "veggie-burger", state: "pending" },
      { product: "grilled-corn", state: "pending" },
    ],
  },
  {
    key: "c19",
    channel: "cash",
    attendee: "farah",
    createdMinsAgo: 120,
    items: [
      {
        product: "belgian-waffle",
        state: "fulfilled",
        rating: { stars: 5, comment: "Loved the compote." },
      },
    ],
  },
  {
    key: "c20",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 5,
    items: [
      { product: "augustiner-helles", state: "pending" },
      { product: "paulaner-helles", state: "pending" },
    ],
  },

  // --- Card (tab) orders ---
  {
    key: "t01",
    channel: "card",
    attendee: "andi",
    tab: "andi",
    createdMinsAgo: 105,
    items: [
      {
        product: "augustiner-helles",
        state: "fulfilled",
        rating: { stars: 5, comment: "Quick service via the tab!" },
      },
      { product: "bratwurst", state: "fulfilled" },
    ],
  },
  {
    key: "t02",
    channel: "card",
    attendee: "andi",
    tab: "andi",
    createdMinsAgo: 40,
    items: [{ product: "augustiner-helles", state: "ready" }],
  },
  {
    key: "t03",
    channel: "card",
    attendee: "julia",
    tab: "julia",
    createdMinsAgo: 85,
    items: [
      {
        product: "iced-latte",
        state: "fulfilled",
        rating: { stars: 4, comment: "Refreshing." },
      },
      { product: "belgian-waffle", state: "preparing" },
    ],
  },
  {
    key: "t04",
    channel: "card",
    attendee: "gabriel",
    tab: "gabriel",
    createdMinsAgo: 75,
    items: [
      { product: "steak-sandwich", state: "ready" },
      { product: "augustiner-helles", state: "fulfilled" },
      { product: "grilled-corn", state: "pending" },
    ],
  },
  {
    key: "t05",
    channel: "card",
    attendee: "lena",
    tab: "lena",
    createdMinsAgo: 150,
    items: [
      {
        product: "veggie-burger",
        state: "fulfilled",
        rating: { stars: 5, comment: "Great value on the tab." },
      },
      { product: "paulaner-helles", state: "fulfilled" },
      { product: "ice-cream-cup", state: "fulfilled" },
    ],
  },

  // --- More cancelled + refunded cash orders ---
  {
    key: "c21",
    channel: "cash",
    attendee: "julia",
    createdMinsAgo: 88,
    items: [
      { product: "bratwurst", state: "fulfilled" },
      { product: "veggie-burger", state: "cancelled" },
    ],
    refundCents: 590, // cancelled veggie burger refunded
  },
  {
    key: "c22",
    channel: "cash",
    attendee: null,
    createdMinsAgo: 66,
    items: [
      { product: "augustiner-helles", state: "cancelled" },
      { product: "augustiner-helles", state: "fulfilled" },
    ],
    refundCents: 450, // one cancelled Augustiner Helles refunded
  },
  // --- More refund-ready cash orders (cancelled, not yet refunded) ---
  {
    key: "c23",
    channel: "cash",
    attendee: "kwame",
    createdMinsAgo: 52,
    items: [
      { product: "belgian-waffle", state: "fulfilled" },
      { product: "ice-cream-cup", state: "cancelled" },
    ],
  },
  {
    key: "c24",
    channel: "cash",
    attendee: "bella",
    createdMinsAgo: 42,
    items: [
      { product: "bratwurst", state: "cancelled" },
      { product: "augustiner-helles", state: "cancelled" },
      { product: "bavarian-pretzel", state: "fulfilled" },
    ],
  },

  // --- Orders awaiting cash payment (unpaid: paidAt null, no cashPayment) ---
  {
    key: "u01",
    channel: "cash",
    attendee: "hana",
    createdMinsAgo: 8,
    unpaid: true,
    items: [
      { product: "steak-sandwich", state: "pending" },
      { product: "augustiner-helles", state: "pending" },
    ],
  },
  {
    key: "u02",
    channel: "cash",
    attendee: "ewan",
    createdMinsAgo: 6,
    unpaid: true,
    items: [
      { product: "bratwurst", state: "pending" },
      { product: "cola", state: "pending" },
      { product: "ice-cream-cup", state: "pending" },
    ],
  },
  {
    key: "u03",
    channel: "cash",
    attendee: "dana",
    createdMinsAgo: 3,
    unpaid: true,
    items: [
      { product: "augustiner-helles", state: "pending" },
      { product: "bavarian-pretzel", state: "pending" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Purge (idempotency)
// ---------------------------------------------------------------------------

async function purge(): Promise<void> {
  const standIds = await Stand.find({ eventId: EVENT_ID }).distinct("_id");
  const productIds = await Product.find({
    standId: { $in: standIds },
  }).distinct("_id");
  const tabIds = await Tab.find({ eventId: EVENT_ID }).distinct("_id");

  await Promise.all([
    Rating.deleteMany({ eventId: EVENT_ID }),
    ProductImage.deleteMany({ productId: { $in: productIds } }),
    Product.deleteMany({ standId: { $in: standIds } }),
    Stand.deleteMany({ eventId: EVENT_ID }),
    TabPayment.deleteMany({ tabId: { $in: tabIds } }),
    Tab.deleteMany({ eventId: EVENT_ID }),
    Order.deleteMany({ eventId: EVENT_ID }),
    AttendeeSession.deleteMany({ eventId: EVENT_ID }),
    EventLogo.deleteMany({ eventId: EVENT_ID }),
    Payout.deleteMany({ accountId: ACCOUNT_ID }),
  ]);
  await Event.deleteMany({ _id: EVENT_ID });
  await Account.deleteMany({ accountId: ACCOUNT_ID });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Connecting to ${config.mongoUri} ...`);
  await connectDB();

  console.log("Purging existing demo data ...");
  await purge();

  // --- Account (organizer) ---
  await Account.create({
    accountId: ACCOUNT_ID,
    email: ORGANIZER_EMAIL,
    passwordHash: await hashPassword(ORGANIZER_PASSWORD),
    firstName: "Emely",
    lastName: "Bauer",
    iban: "DE89370400440532013000",
    ibanHolderName: "Fachschaft MPIC e.V.",
    payoutLockVersion: 0,
    deletedAt: null,
  });

  // --- Event ---
  await Event.create({
    _id: EVENT_ID,
    accountId: ACCOUNT_ID,
    name: "MPIC Sommerfest",
    plannedDate: daysFromNow(21),
    status: "ACTIVE",
    operatorAccessKey: OPERATOR_ACCESS_KEY,
    ratingsEnabled: true,
    cashierEnabled: true,
    baselineHoldCents: 1000,
    branding: {
      primaryColor: "#5b93c7",
      // Button-text color — the frontend toggle matches "#ffffff"/"#000000"
      // case-sensitively, so keep this lowercase or "White" won't show selected.
      secondaryColor: "#ffffff",
      accentTextColor: null,
      logoUrl: null,
    },
    location: {
      locationName: "MPIC Campus — inner courtyard",
      xCoordinate: BASE_LNG,
      yCoordinate: BASE_LAT,
    },
    startedAt: minsAgo(180),
    deletedAt: null,
  });

  // --- Event logo (optional) ---
  const logo = loadImage(path.join(ASSETS_DIR, "logo"));
  if (logo) {
    await EventLogo.create({
      _id: id("logo:event"),
      eventId: EVENT_ID,
      data: logo.data,
      contentType: logo.contentType,
      byteSize: logo.data.length,
    });
    await Event.updateOne(
      { _id: EVENT_ID },
      { "branding.logoUrl": `/api/events/${EVENT_ID}/logo` }
    );
    console.log("  + event logo loaded");
  }

  // --- Cashier stand ---
  await Stand.create({
    _id: id(`stand:${CASHIER_STAND.slug}`),
    eventId: EVENT_ID,
    standName: CASHIER_STAND.name,
    standType: "CASHIER",
    standStatus: "LIVE",
    accessPasswordHash: await hashPassword(CASHIER_STAND_PASSWORD),
    location: {
      locationName: CASHIER_STAND.locationName,
      xCoordinate: CASHIER_STAND.lng,
      yCoordinate: CASHIER_STAND.lat,
    },
    deletedAt: null,
  });

  // --- Product stands + products + images ---
  let imageCount = 0;
  for (const stand of STANDS) {
    const standId = id(`stand:${stand.slug}`);
    await Stand.create({
      _id: standId,
      eventId: EVENT_ID,
      standName: stand.name,
      standType: "PRODUCT",
      standStatus: "LIVE",
      accessPasswordHash: null,
      location: {
        locationName: stand.locationName,
        xCoordinate: stand.lng,
        yCoordinate: stand.lat,
      },
      deletedAt: null,
    });

    for (const p of stand.products) {
      const pid = id(`product:${p.slug}`);
      productBySlug.set(p.slug, {
        ...p,
        _id: pid,
        standId,
        stock: p.stockMode === "TRACKED" ? p.initialStock : 0,
      });
    }
  }

  // --- Build orders (mutates product.stock and rating aggregates) ---
  for (const spec of ORDERS) buildOrder(spec);

  // --- Persist products (final stock + rating aggregates) ---
  for (const stand of STANDS) {
    for (const p of stand.products) {
      const rt = productBySlug.get(p.slug)!;
      const agg = ratingAgg.get(rt._id) ?? { sum: 0, count: 0 };
      const image = loadImage(path.join(ASSETS_DIR, "products", p.slug));
      await Product.create({
        _id: rt._id,
        standId: rt.standId,
        productName: p.name,
        productDescription: p.description,
        priceIncludingTax: p.priceCents,
        taxRate: p.taxRateBp,
        productImageUrl: image ? `/api/products/${rt._id}/image` : null,
        instantProduct: p.instant,
        stockMode: p.stockMode,
        productStock: p.stockMode === "TRACKED" ? rt.stock : 0,
        productStatus: p.status,
        ratingSum: agg.sum,
        ratingCount: agg.count,
        deletedAt: null,
      });
      if (image) {
        await ProductImage.create({
          _id: id(`image:${p.slug}`),
          productId: rt._id,
          data: image.data,
          contentType: image.contentType,
          byteSize: image.data.length,
        });
        imageCount += 1;
      }
    }
  }

  // --- Attendee sessions ---
  for (const a of ATTENDEES) {
    await AttendeeSession.create({
      _id: id(`session:${a.slug}`),
      eventId: EVENT_ID,
      status: "active",
      email: a.email,
      expiresAt: daysFromNow(2),
    });
  }

  // --- Tabs + baseline holds ---
  for (const tab of TABS) {
    const tabId = id(`tab:${tab.slug}`);
    await Tab.create({
      _id: tabId,
      sessionId: id(`session:${tab.attendee}`),
      eventId: EVENT_ID,
      status: tab.status,
    });

    const captured = tab.capturedCents > 0;
    // Stripe processing fee ~ 1.4% + 25c, only meaningful once captured.
    const fee = captured ? Math.round(tab.capturedCents * 0.014) + 25 : 0;
    await TabPayment.create({
      _id: id(`tabpayment:${tab.slug}`),
      tabId,
      orderId: null, // baseline hold, not tied to a single order
      stripePaymentIntentId: `pi_seed_${tab.slug}`,
      stripeEventId: `evt_seed_${tab.slug}`,
      tabPaymentStatus: captured ? "CAPTURED" : "AUTHORIZED",
      authorizedCentsAmount: tab.authorizedCents,
      capturedCentsAmount: tab.capturedCents,
      processingFeeCents: fee,
      stripeBalanceTxnId: captured ? `txn_seed_${tab.slug}` : null,
      availableOn: captured ? daysFromNow(5) : null,
      expiresAt: captured ? null : daysFromNow(1),
    });
  }

  // --- Insert orders + ratings ---
  await Order.insertMany(orderDocs);
  if (ratingDocs.length > 0) await Rating.insertMany(ratingDocs);

  // --- Summary ---
  const cashOrders = ORDERS.filter((o) => o.channel === "cash").length;
  const cardOrders = ORDERS.filter((o) => o.channel === "card").length;
  const isCashOrder = (o: Record<string, unknown>): boolean =>
    o["tabId"] == null;
  const refundReady = orderDocs.filter(
    (o) =>
      isCashOrder(o) &&
      o["paidAt"] != null &&
      (o["cashRefunds"] as unknown[]).length === 0 &&
      (o["items"] as OrderItemDoc[]).some((i) => i.cancelledAt != null)
  ).length;
  const refunded = orderDocs.filter(
    (o) => (o["cashRefunds"] as unknown[]).length > 0
  ).length;
  const pendingCashPayment = orderDocs.filter(
    (o) => isCashOrder(o) && o["paidAt"] == null
  ).length;

  console.log("\n────────────────────────────────────────────────────────");
  console.log("  Demo data seeded successfully");
  console.log("────────────────────────────────────────────────────────");
  console.log(`  Event:            MPIC Sommerfest (ACTIVE)`);
  console.log(`  Event id:         ${EVENT_ID}`);
  console.log(`  Frontend:         ${config.appBaseUrl}`);
  console.log("");
  console.log("  Organizer login (betreuer):");
  console.log(`    email:          ${ORGANIZER_EMAIL}`);
  console.log(`    password:       ${ORGANIZER_PASSWORD}`);
  console.log("");
  console.log("  Operator / cashier login (POST /api/stands/:standId/login):");
  console.log(`    operatorAccessKey: ${OPERATOR_ACCESS_KEY}`);
  console.log(`    Cash Desk stand id: ${id(`stand:${CASHIER_STAND.slug}`)}`);
  console.log(`    Cash Desk password: ${CASHIER_STAND_PASSWORD}`);
  for (const s of STANDS) {
    console.log(
      `    ${s.name} stand id: ${id(`stand:${s.slug}`)} (no password)`
    );
  }
  console.log("");
  console.log(
    `  Stands: ${STANDS.length} product + 1 cashier | Products: ${productBySlug.size}`
  );
  console.log(
    `  Orders: ${orderDocs.length} (${cashOrders} cash, ${cardOrders} card) | Ratings: ${ratingDocs.length}`
  );
  console.log(`  Cash orders already refunded: ${refunded}`);
  console.log(
    `  Refund-ready cash orders (cancelled, not refunded): ${refundReady}`
  );
  console.log(`  Cash orders awaiting payment (unpaid): ${pendingCashPayment}`);
  console.log(`  Product images loaded: ${imageCount}`);
  console.log("────────────────────────────────────────────────────────\n");

  await disconnectDB();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  void disconnectDB().finally(() => process.exit(1));
});
