import { Order } from "../orders/model";
import { getItemState } from "../orders/service";
import { Product } from "../products/model";
import { Stand } from "../stands/model";
import type { PickupBoard, PickupBoardItem, PickupBoardStand } from "./types";

type ProductSnapshot = {
  _id: string;
  standId: string;
  productName: string;
};

type StandSnapshot = {
  _id: string;
  standName: string;
  standStatus: "LIVE" | "PAUSED";
};

export async function buildPickupBoard(eventId: string): Promise<PickupBoard> {
  const stands = await Stand.find({
    eventId,
    standType: "PRODUCT",
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .select("_id standName standStatus")
    .lean<StandSnapshot[]>();

  if (stands.length === 0) return { eventId, stands: [] };

  const standIds = stands.map((stand) => stand._id);
  const products = await Product.find({
    standId: { $in: standIds },
    deletedAt: null,
  })
    .select("_id standId productName")
    .lean<ProductSnapshot[]>();

  const productById = new Map(
    products.map((product) => [product._id, product])
  );
  const productIds = [...productById.keys()];
  const boardStands: PickupBoardStand[] = stands.map((stand) => ({
    standId: stand._id,
    standName: stand.standName,
    standStatus: stand.standStatus ?? "LIVE",
    inLine: [],
    readyForPickup: [],
  }));
  const boardStandById = new Map(
    boardStands.map((stand) => [stand.standId, stand])
  );

  if (productIds.length === 0) return { eventId, stands: boardStands };

  const orders = await Order.find({
    eventId,
    paidAt: { $ne: null },
    deletedAt: null,
    "items.productId": { $in: productIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  for (const order of orders) {
    for (const item of order.items) {
      const product = productById.get(item.productId);
      if (!product) continue;

      const state = getItemState(item);
      if (state !== "PENDING" && state !== "PREPARING" && state !== "READY") {
        continue;
      }

      const pickupItem: PickupBoardItem = {
        orderId: order._id,
        itemId: item._id,
        orderNumber: order.orderNumber,
        pickupCode: order.pickupCode,
        productId: item.productId,
        productName: product.productName,
        state,
        createdAt: order.createdAt,
        startedAt: item.startedAt,
        readyAt: item.readyAt,
      };

      const boardStand = boardStandById.get(product.standId);
      if (!boardStand) continue;
      if (state === "READY") boardStand.readyForPickup.push(pickupItem);
      else boardStand.inLine.push(pickupItem);
    }
  }

  return { eventId, stands: boardStands };
}

export async function standBelongsToPickupEvent(
  eventId: string,
  standId: string
): Promise<boolean> {
  const stand = await Stand.exists({
    _id: standId,
    eventId,
    standType: "PRODUCT",
    deletedAt: null,
  });
  return Boolean(stand);
}
