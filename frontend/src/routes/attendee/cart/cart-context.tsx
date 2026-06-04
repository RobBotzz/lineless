import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Product } from '@/types/product';

// A line in the cart: the product snapshot plus how many were added. We keep a
// snapshot (not just an id) so the cart page can render without re-fetching.
export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalCents: number;
  addItem: (product: Product) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// One cart per event, persisted so a page refresh keeps the selection.
const storageKey = (eventId: string) => `lineless.cart.${eventId}`;

function readStored(eventId: string): CartItem[] {
  if (!eventId) return [];
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  // Initialised from storage. The provider is keyed by eventId at the mount
  // site, so switching events remounts and re-reads — no re-hydrate effect.
  const [items, setItems] = useState<CartItem[]>(() => readStored(eventId));

  useEffect(() => {
    if (!eventId) return;
    try {
      localStorage.setItem(storageKey(eventId), JSON.stringify(items));
    } catch {
      // Ignore quota / private-mode write failures — cart stays in memory.
    }
  }, [eventId, items]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product._id === product._id);
      if (existing) {
        return prev.map((i) =>
          i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product._id !== productId)
        : prev.map((i) => (i.product._id === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCents = items.reduce((sum, i) => sum + i.product.priceIncludingTax * i.quantity, 0);
    return { items, totalCount, totalCents, addItem, setQuantity, removeItem, clear };
  }, [items, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
