import { useCallback, useEffect, useMemo, useState } from 'react';

import { tracksStock, type Product } from '@/types/product';
import type { StockShortage } from '@/types/order';

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
  setQuantity: (productId: string, quantity: number, currentProduct?: Product) => void;
  setComment: (productId: string, index: number, comment: string) => void;
  removeItem: (productId: string) => void;
  applyStockShortages: (shortages: StockShortage[]) => void;
  syncProducts: (products: Product[]) => void;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseStoredProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  const stockMode =
    value.stockMode === undefined
      ? 'UNLIMITED'
      : value.stockMode === 'UNLIMITED' || value.stockMode === 'TRACKED'
        ? value.stockMode
        : null;
  if (
    !stockMode ||
    typeof value._id !== 'string' ||
    typeof value.standId !== 'string' ||
    typeof value.productName !== 'string' ||
    !isNonNegativeInteger(value.priceIncludingTax) ||
    !isNonNegativeInteger(value.taxRate) ||
    value.taxRate > 10_000 ||
    !isNonNegativeInteger(value.productStock) ||
    (value.productStatus !== 'LIVE' && value.productStatus !== 'PAUSED')
  ) {
    return null;
  }

  return {
    _id: value._id,
    standId: value.standId,
    productName: value.productName,
    productDescription:
      typeof value.productDescription === 'string' ? value.productDescription : null,
    priceIncludingTax: value.priceIncludingTax,
    taxRate: value.taxRate,
    productImageUrl: typeof value.productImageUrl === 'string' ? value.productImageUrl : null,
    instantProduct: typeof value.instantProduct === 'boolean' ? value.instantProduct : false,
    stockMode,
    productStock: value.productStock,
    productStatus: value.productStatus,
    ...(typeof value.rating === 'number' || value.rating === null ? { rating: value.rating } : {}),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

function readStored(persistKey: string | undefined): CartItem[] {
  if (!persistKey) return [];
  try {
    const raw = localStorage.getItem(persistKey);
    if (!raw) return [];
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((value) => {
      if (!isRecord(value) || !isPositiveInteger(value.quantity)) return [];
      const product = parseStoredProduct(value.product);
      if (!product) return [];
      const quantity = value.quantity;
      const comments =
        Array.isArray(value.comments) &&
        value.comments.every((comment) => typeof comment === 'string')
          ? value.comments
          : [];
      return [{ product, quantity, comments: resizeComments(comments, quantity) }];
    });
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
      if (tracksStock(product) && product.productStock <= 0) return prev;
      const existing = prev.find((i) => i.product._id === product._id);
      if (existing) {
        if (tracksStock(product) && existing.quantity >= product.productStock) {
          return prev.map((item) =>
            item.product._id === product._id ? { ...item, product } : item,
          );
        }
        return prev.map((i) =>
          i.product._id === product._id
            ? { ...i, product, quantity: i.quantity + 1, comments: [...i.comments, ''] }
            : i,
        );
      }
      return [...prev, { product, quantity: 1, comments: [''] }];
    });
  }, []);

  const setQuantity = useCallback(
    (productId: string, quantity: number, currentProduct?: Product) => {
      setItems((prev) => {
        const item = prev.find((candidate) => candidate.product._id === productId);
        const product = currentProduct ?? item?.product;
        if (
          !item ||
          !product ||
          quantity <= 0 ||
          (tracksStock(product) && product.productStock <= 0)
        ) {
          return prev.filter((candidate) => candidate.product._id !== productId);
        }
        const nextQuantity = tracksStock(product)
          ? Math.min(quantity, product.productStock)
          : quantity;
        return prev.map((candidate) =>
          candidate.product._id === productId
            ? {
                ...candidate,
                product,
                quantity: nextQuantity,
                comments: resizeComments(candidate.comments, nextQuantity),
              }
            : candidate,
        );
      });
    },
    [],
  );

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

  const applyStockShortages = useCallback((shortages: StockShortage[]) => {
    const availableById = new Map(
      shortages.map((shortage) => [shortage.productId, shortage.available]),
    );
    setItems((prev) =>
      prev.flatMap((item) => {
        const available = availableById.get(item.product._id);
        if (available === undefined) return [item];
        if (available <= 0) return [];
        const quantity = Math.min(item.quantity, available);
        return [
          {
            ...item,
            product: { ...item.product, productStock: available },
            quantity,
            comments: resizeComments(item.comments, quantity),
          },
        ];
      }),
    );
  }, []);

  const syncProducts = useCallback((products: Product[]) => {
    const productById = new Map(products.map((product) => [product._id, product]));
    setItems((prev) =>
      prev.flatMap((item) => {
        const product = productById.get(item.product._id);
        if (!product) return [item];
        if (tracksStock(product) && product.productStock <= 0) return [];
        const quantity = tracksStock(product)
          ? Math.min(item.quantity, product.productStock)
          : item.quantity;
        return [
          {
            ...item,
            product,
            quantity,
            comments: resizeComments(item.comments, quantity),
          },
        ];
      }),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return useMemo<CartState>(() => {
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCents = items.reduce((sum, i) => sum + i.product.priceIncludingTax * i.quantity, 0);
    return {
      items,
      totalCount,
      totalCents,
      addItem,
      setQuantity,
      setComment,
      removeItem,
      applyStockShortages,
      syncProducts,
      clear,
    };
  }, [
    items,
    addItem,
    setQuantity,
    setComment,
    removeItem,
    applyStockShortages,
    syncProducts,
    clear,
  ]);
}
