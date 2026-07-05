import type { LiveOrder, LiveOrderItem } from '@/api/eventControlCenter';

export type CancelItemsRequest = {
  orderId: string;
  itemIds: string[];
};

export function getCancellableOrderItems(order: LiveOrder): LiveOrderItem[] {
  return order.items.filter((item) => !item.readyAt);
}
// Returns a list of cancellation requests for the specified products
export function getCancelRequestsForProducts(
  orders: LiveOrder[],
  productIds: Set<string>,
): CancelItemsRequest[] {
  return orders
    .map((order) => ({
      orderId: order._id,
      itemIds: order.items
        .filter((item) => productIds.has(item.productId) && !item.readyAt)
        .map((item) => item.itemId),
    }))
    .filter((request) => request.itemIds.length > 0);
}

export function countCancelItems(requests: CancelItemsRequest[]): number {
  return requests.reduce((total, request) => total + request.itemIds.length, 0);
}
