import { useMemo, useState } from 'react';

import {
  EVENT_CONTROL_CENTER_STREAM_EVENT,
  EVENT_ORDERS_STREAM_EVENT,
  eventControlCenterStreamPath,
  eventOrdersStreamPath,
  getEventControlCenter,
  getEventOrders,
  type EventControlCenterData,
  type LiveOrder,
} from '@/api/eventControlCenter';
import { cancelOrder, cancelOrderItems } from '@/api/orders';
import { useSSE, type SseStatus } from '@/hooks/useSSE';
import {
  getStandProducts,
  pauseProduct,
  ProductStockChangedError,
  resumeProduct,
  updateProductStock,
} from '@/api/products';
import { getEventStands, pauseStand, resumeStand } from '@/api/stands';
import { isEventControlCenterData, isLiveOrderArray } from '@/types/eventControlCenter';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export function useEventControlCenterLiveData({
  eventId,
  initialAnalytics,
  initialLiveOrders,
  initialProductsByStand,
  initialStands,
}: {
  eventId: string;
  initialAnalytics: EventControlCenterData;
  initialLiveOrders: LiveOrder[];
  initialProductsByStand: Record<string, Product[]>;
  initialStands: Stand[];
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [liveOrders, setLiveOrders] = useState(initialLiveOrders);
  const [productsByStand, setProductsByStand] = useState(initialProductsByStand);
  const [stands, setStands] = useState(initialStands);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const analyticsStreamPath = useMemo(() => eventControlCenterStreamPath(eventId), [eventId]);
  const ordersStreamPath = useMemo(() => eventOrdersStreamPath(eventId), [eventId]);

  const analyticsStream = useSSE({
    auth: 'organizer',
    path: analyticsStreamPath,
    onMessage: (message) => {
      if (message.event !== EVENT_CONTROL_CENTER_STREAM_EVENT) return;
      if (!isEventControlCenterData(message.data)) return;
      setAnalytics(message.data);
      setLastUpdatedAt(new Date());
    },
  });
  const ordersStream = useSSE({
    auth: 'organizer',
    path: ordersStreamPath,
    onMessage: (message) => {
      if (message.event !== EVENT_ORDERS_STREAM_EVENT) return;
      if (!isLiveOrderArray(message.data)) return;
      setLiveOrders(message.data);
      setLastUpdatedAt(new Date());
    },
  });
  const streamStatus = getCombinedStreamStatus(analyticsStream.status, ordersStream.status);
  const streamError = analyticsStream.error ?? ordersStream.error;

  async function refreshSnapshot() {
    const [nextAnalytics, nextLiveOrders] = await Promise.all([
      getEventControlCenter(eventId),
      getEventOrders(eventId),
    ]);
    setAnalytics(nextAnalytics);
    setLiveOrders(nextLiveOrders);
    setLastUpdatedAt(new Date());
  }

  async function refreshOperationalSnapshot() {
    const nextStands = await getEventStands(eventId);
    const productsByStandEntries = await Promise.all(
      nextStands.map(async (stand) => {
        const products = await getStandProducts(stand._id).catch(() => [] as Product[]);
        return [stand._id, products] as const;
      }),
    );

    setStands(nextStands);
    setProductsByStand(Object.fromEntries(productsByStandEntries));
    setLastUpdatedAt(new Date());
  }

  async function recoverLiveSnapshot() {
    try {
      await refreshSnapshot();
    } catch {
      // Keep the original mutation failure visible to the user.
    }
  }

  async function refreshLiveSnapshotIfStreamClosed() {
    if (streamStatus === 'open') return;
    await refreshSnapshot();
  }

  async function recoverOperationalSnapshot() {
    try {
      await refreshOperationalSnapshot();
    } catch {
      // Keep the original mutation failure visible to the user.
    }
  }

  async function handleCancelOrder(orderId: string) {
    setMutationError(null);
    try {
      await cancelOrder(orderId);
      await refreshLiveSnapshotIfStreamClosed();
    } catch (error) {
      await recoverLiveSnapshot();
      setMutationError('Order could not be cancelled.');
      throw error;
    }
  }

  async function handleCancelOrderItems(orderId: string, itemIds: string[]) {
    setMutationError(null);
    try {
      await cancelOrderItems(orderId, itemIds);
      await refreshLiveSnapshotIfStreamClosed();
    } catch (error) {
      await recoverLiveSnapshot();
      setMutationError('Selected items could not be cancelled.');
      throw error;
    }
  }

  async function handleProductPauseChange(standId: string, product: Product, paused: boolean) {
    setMutationError(null);
    try {
      if (paused) {
        await pauseProduct(product._id);
      } else {
        await resumeProduct(product._id);
      }

      const currentStandProducts = productsByStand[standId] ?? [];
      const nextStandProducts = currentStandProducts.map((candidate) =>
        candidate._id === product._id
          ? { ...candidate, productStatus: paused ? 'PAUSED' : 'LIVE' }
          : candidate,
      );

      if (paused) {
        const hasLiveProducts = nextStandProducts.some(
          (candidate) => candidate.productStatus === 'LIVE',
        );
        const stand = stands.find((candidate) => candidate._id === standId);
        if (!hasLiveProducts && stand?.standStatus === 'LIVE') {
          const updatedStand = await pauseStand(standId);
          setStands((current) =>
            current.map((candidate) => (candidate._id === standId ? updatedStand : candidate)),
          );
        }
      } else {
        const stand = stands.find((candidate) => candidate._id === standId);
        if (stand?.standStatus === 'PAUSED') {
          const updatedStand = await resumeStand(standId);
          setStands((current) =>
            current.map((candidate) => (candidate._id === standId ? updatedStand : candidate)),
          );
        }
      }

      setProductsByStand((current) => ({
        ...current,
        [standId]: (current[standId] ?? []).map((candidate) =>
          candidate._id === product._id
            ? { ...candidate, productStatus: paused ? 'PAUSED' : 'LIVE' }
            : candidate,
        ),
      }));
    } catch (error) {
      await recoverOperationalSnapshot();
      setMutationError('Product availability could not be changed.');
      throw error;
    }
  }

  async function handleStandPauseChange(stand: Stand, paused: boolean) {
    setMutationError(null);
    if ((stand.standStatus === 'PAUSED') === paused) return;
    try {
      const updatedStand = paused ? await pauseStand(stand._id) : await resumeStand(stand._id);
      const standProducts = productsByStand[stand._id] ?? [];
      const productsToSync = standProducts.filter((product) =>
        paused ? product.productStatus === 'LIVE' : product.productStatus === 'PAUSED',
      );

      await Promise.all(
        productsToSync.map((product) =>
          paused ? pauseProduct(product._id) : resumeProduct(product._id),
        ),
      );

      setStands((current) =>
        current.map((candidate) => (candidate._id === stand._id ? updatedStand : candidate)),
      );
      setProductsByStand((current) => ({
        ...current,
        [stand._id]: (current[stand._id] ?? []).map((product) =>
          product.productStatus === 'TERMINATED'
            ? product
            : { ...product, productStatus: paused ? 'PAUSED' : 'LIVE' },
        ),
      }));
    } catch (error) {
      await recoverOperationalSnapshot();
      setMutationError('Stand availability could not be changed.');
      throw error;
    }
  }

  async function handleProductStockChange(standId: string, product: Product, productStock: number) {
    setMutationError(null);
    try {
      const updatedProduct = await updateProductStock(
        product._id,
        product.productStock,
        productStock,
      );
      setProductsByStand((current) => ({
        ...current,
        [standId]: (current[standId] ?? []).map((candidate) =>
          candidate._id === product._id ? updatedProduct : candidate,
        ),
      }));
    } catch (error) {
      if (error instanceof ProductStockChangedError) {
        setProductsByStand((current) => ({
          ...current,
          [standId]: (current[standId] ?? []).map((candidate) =>
            candidate._id === product._id
              ? { ...candidate, productStock: error.currentProductStock }
              : candidate,
          ),
        }));
        setMutationError('Product stock changed during editing. The current value was loaded.');
        throw error;
      }
      await recoverOperationalSnapshot();
      setMutationError('Product stock could not be saved.');
      throw error;
    }
  }

  return {
    analytics,
    handleCancelOrder,
    handleCancelOrderItems,
    handleProductPauseChange,
    handleProductStockChange,
    handleStandPauseChange,
    lastUpdatedAt,
    liveOrders,
    mutationError,
    productsByStand,
    stands,
    streamError,
    streamStatus,
  };
}

function getCombinedStreamStatus(left: SseStatus, right: SseStatus): SseStatus {
  if (left === 'error' || right === 'error') return 'error';
  if (left === 'connecting' || right === 'connecting') return 'connecting';
  if (left === 'open' && right === 'open') return 'open';
  return 'idle';
}
