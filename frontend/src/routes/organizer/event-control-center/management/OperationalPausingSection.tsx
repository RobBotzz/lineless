import { useState } from 'react';

import type { LiveOrder } from '@/api/eventControlCenter';
import { AlertDialog } from '@/components/feedback';
import { LockIcon, UnlockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { formatMoney, type Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { EmptyState } from '../components/EmptyState';
import {
  countCancelItems,
  getCancelRequestsForProducts,
  type CancelItemsRequest,
} from './cancellationUtils';

export function OperationalPausingSection({
  liveOrders,
  onCancelOrderItems,
  onProductPauseChange,
  onStandPauseChange,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  productsByStand: Record<string, Product[]>;
  stands: Stand[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Pausing</CardTitle>
      </CardHeader>
      <CardContent>
        {stands.length > 0 ? (
          <div className="space-y-4">
            {stands.map((stand) => (
              <StandPausePanel
                key={stand._id}
                liveOrders={liveOrders}
                onCancelOrderItems={onCancelOrderItems}
                onProductPauseChange={onProductPauseChange}
                onStandPauseChange={onStandPauseChange}
                products={productsByStand[stand._id] ?? []}
                stand={stand}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No stands configured"
            message="Create stands before station or product pausing can be managed."
          />
        )}
      </CardContent>
    </Card>
  );
}

function StandPausePanel({
  liveOrders,
  onCancelOrderItems,
  onProductPauseChange,
  onStandPauseChange,
  products,
  stand,
}: {
  liveOrders: LiveOrder[];
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  products: Product[];
  stand: Stand;
}) {
  const [isCancellingStand, setIsCancellingStand] = useState(false);
  const [pendingBulkCancel, setPendingBulkCancel] = useState<{
    label: string;
    requests: CancelItemsRequest[];
  } | null>(null);
  const productIds = products.map((product) => product._id);
  const standCancelRequests = getCancelRequestsForProducts(liveOrders, new Set(productIds));
  const standCancellableItemCount = countCancelItems(standCancelRequests);
  const isStandPaused = stand.standStatus === 'PAUSED';

  async function cancelRequests(requests: CancelItemsRequest[]) {
    setIsCancellingStand(true);
    try {
      await Promise.all(
        requests.map((request) => onCancelOrderItems(request.orderId, request.itemIds)),
      );
    } finally {
      setIsCancellingStand(false);
    }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-background">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-text">{stand.standName}</h3>
            <p className="mt-1 text-xs text-text-muted">
              Stand pause blocks new orders while existing orders stay visible.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <StandAvailabilityControl onPauseChange={onStandPauseChange} stand={stand} />
            {isStandPaused ? (
              <Button
                className="w-full whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
                disabled={isCancellingStand || standCancellableItemCount === 0}
                onClick={() =>
                  setPendingBulkCancel({
                    label: stand.standName,
                    requests: standCancelRequests,
                  })
                }
                size="sm"
                variant="outline"
              >
                Cancel Everything ({standCancellableItemCount})
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {products.length > 0 ? (
            products.map((product) => (
              <ProductPauseTile
                liveOrders={liveOrders}
                key={product._id}
                onCancelOrderItems={onCancelOrderItems}
                product={product}
                standId={stand._id}
                onPauseChange={onProductPauseChange}
              />
            ))
          ) : (
            <p className="text-sm text-text-muted">No products configured for this stand.</p>
          )}
        </div>
      </section>
      <AlertDialog
        acknowledgeLabel="Cancel everything"
        cancelLabel="Keep items"
        message={
          pendingBulkCancel
            ? `${countCancelItems(pendingBulkCancel.requests)} not-ready item${
                countCancelItems(pendingBulkCancel.requests) === 1 ? '' : 's'
              } for ${pendingBulkCancel.label} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => {
          const cancellation = pendingBulkCancel;
          setPendingBulkCancel(null);
          if (cancellation) void cancelRequests(cancellation.requests);
        }}
        onCancel={() => setPendingBulkCancel(null)}
        title="Cancel everything?"
      />
    </>
  );
}

function StandAvailabilityControl({
  onPauseChange,
  stand,
}: {
  onPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  stand: Stand;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const isLive = stand.standStatus === 'LIVE';

  async function handleToggle() {
    setIsSaving(true);
    try {
      await onPauseChange(stand, isLive);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        aria-label={`${stand.standName} is ${isLive ? 'open and accepting new orders' : 'paused for new orders'}.`}
        className={[
          'relative h-11 w-full rounded-full border border-border bg-surface p-1 text-sm shadow-sm transition-colors sm:w-64',
          isSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        ].join(' ')}
        disabled={isSaving}
        onClick={() => void handleToggle()}
        type="button"
      >
        <span className="grid h-full grid-cols-2 items-center rounded-full bg-surface-muted">
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-accent' : 'text-text-muted',
            ].join(' ')}
          >
            <UnlockIcon className="h-4 w-4" />
            Open
          </span>
          <span
            className={[
              'flex items-center justify-center gap-1.5 font-semibold',
              isLive ? 'text-text-muted' : 'text-danger',
            ].join(' ')}
          >
            <LockIcon className="h-4 w-4" />
            Paused
          </span>
        </span>
        <span
          className={[
            'absolute inset-y-1 flex w-[calc(50%-0.25rem)] items-center justify-center gap-1.5 rounded-full px-3 font-semibold text-[var(--color-button-text)] shadow-sm transition-[left,right,background-color]',
            isLive ? 'left-1 bg-accent' : 'right-1 bg-danger',
          ].join(' ')}
        >
          {isLive ? <UnlockIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
          {isLive ? 'Open' : 'Paused'}
        </span>
      </button>
    </div>
  );
}

function ProductPauseTile({
  liveOrders,
  onCancelOrderItems,
  onPauseChange,
  product,
  standId,
}: {
  liveOrders: LiveOrder[];
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  product: Product;
  standId: string;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<CancelItemsRequest[] | null>(null);
  const isLive = product.productStatus === 'LIVE';
  const isPaused = product.productStatus === 'PAUSED';
  const isTerminated = product.productStatus === 'TERMINATED';
  const cancelRequests = getCancelRequestsForProducts(liveOrders, new Set([product._id]));
  const cancellableItemCount = countCancelItems(cancelRequests);
  const availabilityText = isTerminated
    ? 'terminated product'
    : isPaused
      ? 'hidden from new orders'
      : 'available for new orders';

  async function handleAvailabilityChange(checked: boolean) {
    if (isTerminated) return;
    setIsSaving(true);
    try {
      await onPauseChange(standId, product, !checked);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancelEverything(requests: CancelItemsRequest[]) {
    setIsCancelling(true);
    try {
      await Promise.all(
        requests.map((request) => onCancelOrderItems(request.orderId, request.itemIds)),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <div
        className={[
          'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3',
          isTerminated ? 'opacity-70' : '',
        ].join(' ')}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{product.productName}</p>
          <p className="mt-1 text-xs text-text-muted">
            EUR {formatMoney(product.priceIncludingTax)} / {availabilityText}
          </p>
          {isPaused ? (
            <Button
              className="mt-3 whitespace-nowrap border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
              disabled={isCancelling || cancellableItemCount === 0}
              onClick={() => setPendingCancel(cancelRequests)}
              size="sm"
              variant="outline"
            >
              Cancel Everything ({cancellableItemCount})
            </Button>
          ) : null}
        </div>
        <Toggle
          checked={isLive}
          disabled={isSaving || isTerminated}
          label={`${product.productName} available for orders`}
          onChange={(checked) => void handleAvailabilityChange(checked)}
        />
      </div>
      <AlertDialog
        acknowledgeLabel="Cancel everything"
        cancelLabel="Keep items"
        message={
          pendingCancel
            ? `${countCancelItems(pendingCancel)} not-ready item${
                countCancelItems(pendingCancel) === 1 ? '' : 's'
              } for ${product.productName} will be cancelled. Ready items stay active.`
            : null
        }
        onAcknowledge={() => {
          const cancellation = pendingCancel;
          setPendingCancel(null);
          if (cancellation) void handleCancelEverything(cancellation);
        }}
        onCancel={() => setPendingCancel(null)}
        title="Cancel everything?"
      />
    </>
  );
}
