import { useMemo, useState } from 'react';

import {
  EVENT_CONTROL_CENTER_STREAM_EVENT,
  EVENT_ORDERS_STREAM_EVENT,
  cancelOrder,
  cancelOrderItems,
  eventControlCenterStreamPath,
  eventOrdersStreamPath,
  getEventControlCenter,
  getEventOrders,
  pauseProduct,
  pauseStand,
  resumeProduct,
  resumeStand,
  updateProductStock,
  type EventControlCenterData,
  type EventControlCenterSettings,
  type LiveOrder,
} from '@/api/eventControlCenter';
import { useSSE, type SseStatus } from '@/hooks/useSSE';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';

export function useEventControlCenterLiveData({
  controlCenterSettings,
  eventId,
  initialAnalytics,
  initialLiveOrders,
  initialProductsByStand,
  initialStands,
}: {
  controlCenterSettings: EventControlCenterSettings;
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
  const analyticsStreamPath = useMemo(
    () => eventControlCenterStreamPath(eventId, controlCenterSettings),
    [controlCenterSettings, eventId],
  );
  const ordersStreamPath = useMemo(() => eventOrdersStreamPath(eventId), [eventId]);

  const analyticsStream = useSSE({
    auth: 'organizer',
    path: analyticsStreamPath,
    onMessage: (message) => {
      if (message.event !== EVENT_CONTROL_CENTER_STREAM_EVENT) return;
      setAnalytics(message.data as EventControlCenterData);
      setLastUpdatedAt(new Date());
    },
  });
  const ordersStream = useSSE({
    auth: 'organizer',
    path: ordersStreamPath,
    onMessage: (message) => {
      if (message.event !== EVENT_ORDERS_STREAM_EVENT) return;
      setLiveOrders(message.data as LiveOrder[]);
      setLastUpdatedAt(new Date());
    },
  });
  const streamStatus = getCombinedStreamStatus(analyticsStream.status, ordersStream.status);
  const streamError = analyticsStream.error ?? ordersStream.error;

  async function refreshSnapshot() {
    const [nextAnalytics, nextLiveOrders] = await Promise.all([
      getEventControlCenter(eventId, controlCenterSettings),
      getEventOrders(eventId),
    ]);
    setAnalytics(nextAnalytics);
    setLiveOrders(nextLiveOrders);
    setLastUpdatedAt(new Date());
  }

  async function handleCancelOrder(orderId: string) {
    await cancelOrder(eventId, orderId);
    await refreshSnapshot();
  }

  async function handleCancelOrderItems(orderId: string, itemIds: string[]) {
    await cancelOrderItems(eventId, orderId, itemIds);
    await refreshSnapshot();
  }

  async function handleProductPauseChange(standId: string, product: Product, paused: boolean) {
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
        const updatedStand = await pauseStand(eventId, standId);
        setStands((current) =>
          current.map((candidate) => (candidate._id === standId ? updatedStand : candidate)),
        );
      }
    } else {
      const stand = stands.find((candidate) => candidate._id === standId);
      if (stand?.standStatus === 'PAUSED') {
        const updatedStand = await resumeStand(eventId, standId);
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
  }

  async function handleStandPauseChange(stand: Stand, paused: boolean) {
    const updatedStand = paused
      ? await pauseStand(eventId, stand._id)
      : await resumeStand(eventId, stand._id);
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
  }

  async function handleProductStockChange(standId: string, product: Product, productStock: number) {
    const updatedProduct = await updateProductStock(eventId, standId, product._id, productStock);
    setProductsByStand((current) => ({
      ...current,
      [standId]: (current[standId] ?? []).map((candidate) =>
        candidate._id === product._id ? updatedProduct : candidate,
      ),
    }));
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
