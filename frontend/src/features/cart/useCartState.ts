import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Product } from '@/types/product';

// A line in the cart: the product snapshot plus how many were added. We keep a
// snapshot (not just an id) so the cart page can render without re-fetching.
export interface CartItem {
  product: Product;
  quantity: number;
  comments: string[];
}

export interface CartState {
  items: CartItem[];
  totalCount: number;
  totalCents: number;
  addItem: (product: Product) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setComment: (productId: string, index: number, comment: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

interface UseCartStateOptions {
  // When set, the cart is hydrated from and persisted to localStorage under this
  // key (attendee, one cart per event). When omitted, the cart lives only in
  // memory and is gone on refresh (cashier, fresh per customer).
  persistKey?: string;
}

// Force a comments array to match `quantity`: trim extras, pad missing with ''.
function resizeComments(comments: string[] | undefined, quantity: number): string[] {
  const base = Array.isArray(comments) ? comments.slice(0, quantity) : [];
  while (base.length < quantity) base.push('');
  return base;
}

function readStored(persistKey: string | undefined): CartItem[] {
  if (!persistKey) return [];
  try {
    const raw = localStorage.getItem(persistKey);
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

// The cart reducer, persona-agnostic. Persistence is opt-in via `persistKey`.
export function useCartState({ persistKey }: UseCartStateOptions = {}): CartState {
  const [items, setItems] = useState<CartItem[]>(() => readStored(persistKey));

  useEffect(() => {
    if (!persistKey) return;
    try {
      localStorage.setItem(persistKey, JSON.stringify(items));
    } catch {
      // Ignore quota / private-mode write failures — cart stays in memory.
    }
  }, [persistKey, items]);

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

  return useMemo<CartState>(() => {
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCents = items.reduce((sum, i) => sum + i.product.priceIncludingTax * i.quantity, 0);
    return { items, totalCount, totalCents, addItem, setQuantity, setComment, removeItem, clear };
  }, [items, addItem, setQuantity, setComment, removeItem, clear]);
}
