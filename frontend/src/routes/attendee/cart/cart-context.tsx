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
  comments: string[];
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalCents: number;
  addItem: (product: Product) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setComment: (productId: string, index: number, comment: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// One cart per event, persisted so a page refresh keeps the selection.
const storageKey = (eventId: string) => `lineless.cart.${eventId}`;

// Force a comments array to match `quantity`: trim extras, pad missing with ''.
function resizeComments(comments: string[] | undefined, quantity: number): string[] {
  const base = Array.isArray(comments) ? comments.slice(0, quantity) : [];
  while (base.length < quantity) base.push('');
  return base;
}

function readStored(eventId: string): CartItem[] {
  if (!eventId) return [];
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    if (!raw) return [];
    // Normalise: older carts may predate `comments`, so backfill them here.
    return (JSON.parse(raw) as CartItem[]).map((item) => ({
      ...item,
      comments: resizeComments(item.comments, item.quantity),
    }));
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
          i.product._id === product._id
            ? { ...i, quantity: i.quantity + 1, comments: [...i.comments, ''] }
            : i,
        );
      }
      return [...prev, { product, quantity: 1, comments: [''] }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product._id !== productId)
        : prev.map((i) =>
            i.product._id === productId
              ? { ...i, quantity, comments: resizeComments(i.comments, quantity) }
              : i,
          ),
    );
  }, []);

  const setComment = useCallback((productId: string, index: number, comment: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product._id === productId
          ? { ...i, comments: i.comments.map((c, idx) => (idx === index ? comment : c)) }
          : i,
      ),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCents = items.reduce((sum, i) => sum + i.product.priceIncludingTax * i.quantity, 0);
    return { items, totalCount, totalCents, addItem, setQuantity, setComment, removeItem, clear };
  }, [items, addItem, setQuantity, setComment, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
