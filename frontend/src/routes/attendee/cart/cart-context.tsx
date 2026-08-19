import { createContext, useContext, type ReactNode } from 'react';

import { useCartState, type CartItem, type CartState } from '@/features/cart/useCartState';

// Re-exported so existing attendee imports of the cart item type keep working.
export type { CartItem };

const CartContext = createContext<CartState | null>(null);

// One cart per event, persisted so a page refresh keeps the selection.
const storageKey = (eventId: string) => `lineless.cart.${eventId}`;

export function CartProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  // The provider is keyed by eventId at the mount site, so switching events
  // remounts and re-reads from storage. No eventId -> in-memory only.
  const cart = useCartState({ persistKey: eventId ? storageKey(eventId) : undefined });
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
