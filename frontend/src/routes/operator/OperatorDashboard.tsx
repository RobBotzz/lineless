import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { OPERATOR_BOARD_STREAM_EVENT, operatorBoardStreamPath } from '@/api/operatorBoard';
import { advanceOrderItemAsOperator } from '@/api/orders';
import { pauseProductAsOperator, resumeProductAsOperator } from '@/api/products';
import { AlertDialog } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSSE, type SseStatus } from '@/hooks/useSSE';
import { formatMoney } from '@/types/product';
import type { BoardItem, BoardItemState, BoardProduct, OperatorBoard } from '@/types/operatorBoard';

const PRODUCT_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
];

const BOARD_COLUMNS: Array<{ state: BoardItemState; title: string; empty: string }> = [
  { state: 'PENDING', title: 'To Do', empty: 'No open items.' },
  { state: 'PREPARING', title: 'In Progress', empty: 'Nothing in progress.' },
  { state: 'READY', title: 'Ready', empty: 'Nothing ready for pickup.' },
];

export default function Dashboard() {
  const { standId } = useParams();
  const [board, setBoard] = useState<OperatorBoard | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<BoardItem | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const stream = useSSE({
    auth: 'operator',
    enabled: Boolean(standId),
    path: standId ? operatorBoardStreamPath() : null,
    standId,
    onMessage: (message) => {
      if (message.event !== OPERATOR_BOARD_STREAM_EVENT) return;
      setBoard(message.data as OperatorBoard);
    },
  });
  const colorByProductId = useMemo(() => {
    const products = board?.products ?? [];
    return new Map(
      products.map((product, index) => [
        product.productId,
        PRODUCT_COLORS[index % PRODUCT_COLORS.length]!,
      ]),
    );
  }, [board?.products]);
  const visibleItems = selectedProductId
    ? (board?.items ?? []).filter((item) => item.productId === selectedProductId)
    : (board?.items ?? []);

  async function advanceItem(item: BoardItem) {
    if (!standId || busyItemId) return;
    if (item.state === 'READY') {
      setPendingItem(item);
      return;
    }

    const action = item.state === 'PENDING' ? 'start' : 'ready';
    setBusyItemId(item.itemId);
    try {
      await advanceOrderItemAsOperator(item.orderId, item.itemId, action, standId);
    } finally {
      setBusyItemId(null);
    }
  }

  async function fulfillPendingItem() {
    const item = pendingItem;
    if (!standId || !item) return;
    setPendingItem(null);
    setBusyItemId(item.itemId);
    try {
      await advanceOrderItemAsOperator(item.orderId, item.itemId, 'fulfill', standId);
    } finally {
      setBusyItemId(null);
    }
  }

  async function toggleProduct(product: BoardProduct) {
    if (!standId || product.productStatus === 'TERMINATED') return;
    setBusyProductId(product.productId);
    try {
      if (product.productStatus === 'LIVE') {
        await pauseProductAsOperator(product.productId, standId);
      } else {
        await resumeProductAsOperator(product.productId, standId);
      }
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ConnectionStatus status={stream.status} />
        {stream.error ? (
          <span className="text-sm font-medium text-danger">{stream.error.message}</span>
        ) : null}
      </div>

      <ProductOverview
        busyProductId={busyProductId}
        colorByProductId={colorByProductId}
        products={board?.products ?? []}
        selectedProductId={selectedProductId}
        onSelectProduct={(productId) =>
          setSelectedProductId((current) => (current === productId ? null : productId))
        }
        onToggleProduct={(product) => void toggleProduct(product)}
      />

      {board ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {BOARD_COLUMNS.map((column) => {
            const items = visibleItems.filter((item) => item.state === column.state);
            return (
              <BoardColumn
                colorByProductId={colorByProductId}
                empty={column.empty}
                items={items}
                key={column.state}
                onAdvance={(item) => void advanceItem(item)}
                title={column.title}
                busyItemId={busyItemId}
              />
            );
          })}
        </div>
      ) : (
        <LoadingBoard />
      )}

      <AlertDialog
        acknowledgeLabel="Hand over"
        cancelLabel="Keep ready"
        message={
          pendingItem
            ? `Match pickup code ${pendingItem.pickupCode} with the customer before handing over ${pendingItem.productName}.`
            : null
        }
        onAcknowledge={() => void fulfillPendingItem()}
        onCancel={() => setPendingItem(null)}
        title="Confirm pickup"
        variant="success"
      />
    </div>
  );
}

function ProductOverview({
  busyProductId,
  colorByProductId,
  onSelectProduct,
  onToggleProduct,
  products,
  selectedProductId,
}: {
  busyProductId: string | null;
  colorByProductId: Map<string, string>;
  onSelectProduct: (productId: string) => void;
  onToggleProduct: (product: BoardProduct) => void;
  products: BoardProduct[];
  selectedProductId: string | null;
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Products</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {products.length > 0 ? (
          products.map((product) => {
            const selected = selectedProductId === product.productId;
            const color = colorByProductId.get(product.productId) ?? PRODUCT_COLORS[0]!;
            return (
              <div
                className={[
                  'rounded-lg border bg-surface p-3 transition',
                  selected ? 'border-accent shadow-sm' : 'border-border',
                ].join(' ')}
                key={product.productId}
              >
                <button
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => onSelectProduct(product.productId)}
                  type="button"
                >
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text">
                      {product.productName}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {product.openToDo} to do · {product.productStock} stock · EUR{' '}
                      {formatMoney(product.priceIncludingTax)}
                    </span>
                  </span>
                </button>
                <Button
                  className="mt-3 w-full"
                  disabled={busyProductId === product.productId}
                  onClick={() => onToggleProduct(product)}
                  size="sm"
                  variant={product.productStatus === 'LIVE' ? 'secondary' : 'outline'}
                >
                  {product.productStatus === 'TERMINATED'
                    ? 'Terminated'
                    : product.productStatus === 'LIVE'
                      ? 'Pause'
                      : 'Resume'}
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-text-muted">No products configured for this stand.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BoardColumn({
  busyItemId,
  colorByProductId,
  empty,
  items,
  onAdvance,
  title,
}: {
  busyItemId: string | null;
  colorByProductId: Map<string, string>;
  empty: string;
  items: BoardItem[];
  onAdvance: (item: BoardItem) => void;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-text">{title}</h2>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-text-muted">
          {items.length}
        </span>
      </div>
      <div className="space-y-3 p-3">
        {items.length > 0 ? (
          items.map((item) => (
            <BoardCard
              color={colorByProductId.get(item.productId) ?? PRODUCT_COLORS[0]!}
              disabled={busyItemId === item.itemId}
              item={item}
              key={item.itemId}
              onAdvance={() => onAdvance(item)}
            />
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-text-muted">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function BoardCard({
  color,
  disabled,
  item,
  onAdvance,
}: {
  color: string;
  disabled: boolean;
  item: BoardItem;
  onAdvance: () => void;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const actionLabel =
    item.state === 'PENDING' ? 'Start' : item.state === 'PREPARING' ? 'Mark ready' : 'Hand over';

  return (
    <button
      className="w-full rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-70"
      disabled={disabled}
      onClick={onAdvance}
      type="button"
    >
      <span className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-text">
            {item.productName}
          </span>
          <span className="mt-1 block text-xs font-medium text-text-muted">
            #{item.orderNumber} · {actionLabel}
          </span>
        </span>
        <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-text-muted">
          {item.pickupCode}
        </span>
      </span>
      {item.customerComment ? (
        <span
          className="mt-3 block rounded-md border border-border bg-background px-3 py-2 text-xs text-text-muted"
          onClick={(event) => {
            event.stopPropagation();
            setCommentOpen((current) => !current);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="flex items-center justify-between gap-3 font-semibold">
            Customer comment
            <span>{commentOpen ? 'Hide' : 'Show'}</span>
          </span>
          {commentOpen ? (
            <span className="mt-2 block text-text">{item.customerComment}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function LoadingBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {BOARD_COLUMNS.map((column) => (
        <section className="rounded-lg border border-border bg-background p-4" key={column.state}>
          <div className="h-5 w-28 rounded bg-surface-muted" />
          <div className="mt-4 space-y-3">
            <div className="h-24 rounded-lg bg-surface-muted" />
            <div className="h-24 rounded-lg bg-surface-muted" />
          </div>
        </section>
      ))}
    </div>
  );
}

function ConnectionStatus({ status }: { status: SseStatus }) {
  const config =
    status === 'open'
      ? { label: 'Live', className: 'border-success/30 bg-success/10 text-success' }
      : status === 'connecting'
        ? { label: 'Connecting', className: 'border-accent/30 bg-accent-soft text-accent' }
        : status === 'error'
          ? { label: 'Reconnecting', className: 'border-danger/30 bg-danger/10 text-danger' }
          : { label: 'Idle', className: 'border-border bg-surface text-text-muted' };

  return (
    <span
      className={[
        'inline-flex rounded-full border px-3 py-1 text-sm font-semibold',
        config.className,
      ].join(' ')}
    >
      {config.label}
    </span>
  );
}
