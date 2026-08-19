// Shared order-number filter used by both the cash payment and cash refund
// search screens.
export function filterOrdersByQuery<T extends { orderNumber: string }>(
  orders: T[] | null,
  query: string,
): T[] | null {
  const trimmed = query.trim().toLowerCase();
  if (!orders || !trimmed) return orders;
  return orders.filter((o) => o.orderNumber.toLowerCase().includes(trimmed));
}
