import { Order } from "../orders/model";
import { getItemState } from "../orders/service";
import { Product } from "../products/model";

export type BoardItemState = "PENDING" | "PREPARING" | "READY";

export interface BoardItem {
  orderId: string;
  itemId: string;
  orderNumber: string;
  pickupCode: string;
  productId: string;
  productName: string;
  state: BoardItemState;
  customerComment: string | null;
  startedAt: Date | null;
  readyAt: Date | null;
  createdAt: Date;
}

export interface BoardProduct {
  productId: string;
  productName: string;
  productStock: number;
  paused: boolean;
  openToDo: number;
}

export interface OperatorBoard {
  standId: string;
  items: BoardItem[];
  products: BoardProduct[];
}

// productIds of a stand — used to decide whether a changed order affects this board.
export async function getStandProductIds(
  standId: string
): Promise<Set<string>> {
  const products = await Product.find({ standId, deletedAt: null })
    .select("_id")
    .lean();
  return new Set(products.map((p) => p._id));
}

// Active board for a stand: every non-terminal item of the stand's products,
// plus a per-product summary (open To-Do count, stock, paused). FULFILLED and
// CANCELLED items leave the board.
export async function buildOperatorBoard(
  standId: string
): Promise<OperatorBoard> {
  const products = await Product.find({ standId, deletedAt: null }).lean();
  const productById = new Map(products.map((p) => [p._id, p]));

  const orders = await Order.find({
    paidAt: { $ne: null },
    "items.productId": { $in: [...productById.keys()] },
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: BoardItem[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      const product = productById.get(item.productId);
      if (!product) continue; // item belongs to a different stand
      const state = getItemState(item);
      if (state !== "PENDING" && state !== "PREPARING" && state !== "READY")
        continue;
      items.push({
        orderId: order._id,
        itemId: item._id,
        orderNumber: order.orderNumber,
        pickupCode: order.pickupCode,
        productId: item.productId,
        productName: product.productName,
        state,
        customerComment: item.customerComment,
        startedAt: item.startedAt,
        readyAt: item.readyAt,
        createdAt: order.createdAt,
      });
    }
  }

  const productSummary: BoardProduct[] = products.map((p) => ({
    productId: p._id,
    productName: p.productName,
    productStock: p.productStock,
    paused: p.productStatus !== "LIVE",
    openToDo: items.filter(
      (i) => i.productId === p._id && i.state === "PENDING"
    ).length,
  }));

  return { standId, items, products: productSummary };
}
