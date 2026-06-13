import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import {
  OPERATOR_BOARD_EVENT,
  OPERATOR_BOARD_STREAM_PATH,
  fulfillBoardItem,
  readyBoardItem,
  startBoardItem,
} from '@/api/operatorBoard';
import { useSSE, type SseStatus } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import type { BoardItem, BoardItemState, BoardProduct, OperatorBoard } from '@/types/operatorBoard';
import { BackButton } from '@/components/shared';
import { operatorStandQueryOptions } from '../operatorQueries';

// Each board column maps a state to the transition that advances an item out of it.
type ColumnTransition = (orderId: string, itemId: string, standId: string) => Promise<void>;

interface ColumnConfig {
  state: BoardItemState;
  title: string;
  action: ColumnTransition;
  actionLabel: string;
  dotClassName: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    state: 'PENDING',
    title: 'To Do',
    action: startBoardItem,
    actionLabel: 'Start',
    dotClassName: 'bg-text-muted',
  },
  {
    state: 'PREPARING',
    title: 'In Progress',
    action: readyBoardItem,
    actionLabel: 'Report ready',
    dotClassName: 'bg-accent',
  },
  {
    state: 'READY',
    title: 'Ready',
    action: fulfillBoardItem,
    actionLabel: 'Pick up',
    dotClassName: 'bg-success',
  },
];

const ACTION_ERROR = 'Could not update the item. It may have moved already — try again.';

export default function OperatorDashboard() {
  const { eventId, standId } = useParams();
  const standQuery = useQuery(operatorStandQueryOptions(standId));

  const [board, setBoard] = useState<OperatorBoard | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The stream pushes a fresh full board on every change (and as its first frame),
  // so we just replace local state — no client-side merging of transition responses.
  const handleMessage = useCallback(({ event, data }: { event: string; data: unknown }) => {
    if (event === OPERATOR_BOARD_EVENT) setBoard(data as OperatorBoard);
  }, []);

  const { status } = useSSE({
    path: standId ? OPERATOR_BOARD_STREAM_PATH : null,
    auth: 'operator',
    standId,
    onMessage: handleMessage,
  });

  const advance = useCallback(
    (item: BoardItem) => {
      if (!standId || pending.has(item.itemId)) return;
      const column = COLUMNS.find((c) => c.state === item.state);
      if (!column) return;

      setPending((prev) => new Set(prev).add(item.itemId));
      setActionError(null);
      column
        .action(item.orderId, item.itemId, standId)
        .catch((err: unknown) =>
          setActionError(err instanceof ApiError ? err.message : ACTION_ERROR),
        )
        .finally(() =>
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(item.itemId);
            return next;
          }),
        );
    },
    [pending, standId],
  );

  const items = board?.items ?? [];
  const products = board?.products ?? [];
  const visibleItems = filter ? items.filter((item) => item.productId === filter) : items;
  const openCount = products.reduce((sum, product) => sum + product.openToDo, 0);
  const standName = standQuery.data?.standName;

  // First connect, nothing to show yet.
  if (!board) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.home}>Back</BackButton>
          {status === 'error' ? (
            <StatePanel
              title="Live board unavailable"
              message="The connection to the stand could not be established. Check that the backend is running — the board reconnects automatically."
            />
          ) : (
            <LoadingBoard />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.home}>Back</BackButton>
        </div>

        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text">
                {standName ? `${standName} · Live Board` : 'Live Board'}
              </h1>
              <ConnectionBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Tap an item to move it one stage forward · {items.length} item
              {items.length === 1 ? '' : 's'} active
            </p>
          </div>

          {products.length > 0 && (
            <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
              {products.map((product) => (
                <ProductFilterChip
                  key={product.productId}
                  product={product}
                  count={items.filter((item) => item.productId === product.productId).length}
                  active={filter === product.productId}
                  onToggle={() =>
                    setFilter((current) =>
                      current === product.productId ? null : product.productId,
                    )
                  }
                />
              ))}
            </div>
          )}
        </header>

        {actionError && (
          <div
            className="mb-4 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
            role="alert"
          >
            {actionError}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column.state}
              column={column}
              items={visibleItems.filter((item) => item.state === column.state)}
              pending={pending}
              onAdvance={advance}
            />
          ))}

          <ProductsOverview products={products} openCount={openCount} />
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  items,
  pending,
  onAdvance,
}: {
  column: ColumnConfig;
  items: BoardItem[];
  pending: ReadonlySet<string>;
  onAdvance: (item: BoardItem) => void;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', column.dotClassName)} />
          <h2 className="text-sm font-semibold text-text">{column.title}</h2>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-text-muted">
          {items.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <BoardItemCard
              key={item.itemId}
              item={item}
              actionLabel={column.actionLabel}
              pending={pending.has(item.itemId)}
              onAdvance={() => onAdvance(item)}
            />
          ))
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
            Nothing here.
          </p>
        )}
      </div>
    </section>
  );
}

function BoardItemCard({
  item,
  actionLabel,
  pending,
  onAdvance,
}: {
  item: BoardItem;
  actionLabel: string;
  pending: boolean;
  onAdvance: () => void;
}) {
  const color = productColor(item.productId);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onAdvance}
      style={{ borderLeftColor: color }}
      className="group rounded-md border border-border border-l-4 bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text">{item.productName}</span>
        <span className="shrink-0 text-xs font-medium text-text-muted">#{item.orderNumber}</span>
      </div>

      {item.customerComment && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning/60 px-2 py-0.5 text-xs font-medium text-text">
          <span className="h-1.5 w-1.5 rounded-full bg-text/50" />
          {item.customerComment}
        </span>
      )}

      <span className="mt-3 block text-right text-xs font-semibold text-accent">
        {pending ? 'Saving…' : `${actionLabel} →`}
      </span>
    </button>
  );
}

function ProductsOverview({
  products,
  openCount,
}: {
  products: BoardProduct[];
  openCount: number;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Overview · Products
        </h2>
        <p className="mt-1 text-sm font-semibold text-text">
          {openCount} open item{openCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {products.length > 0 ? (
          products.map((product) => <ProductSummaryRow key={product.productId} product={product} />)
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
            No products configured.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductSummaryRow({ product }: { product: BoardProduct }) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-background p-3',
        product.paused && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: productColor(product.productId) }}
          />
          <span className="text-sm font-semibold text-text">{product.productName}</span>
        </div>
        {/* Pause toggle is intentionally read-only: the backend pause endpoint is a
            501 placeholder (POST /products/:id/pause). Wire this up once it lands. */}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
            product.paused ? 'bg-warning/60 text-text' : 'bg-success/10 text-success',
          )}
        >
          {product.paused ? 'Paused' : 'Live'}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
        <span className="rounded bg-surface-muted px-1.5 py-0.5 font-semibold text-text">
          {product.openToDo}
        </span>
        <span>To Do</span>
        <span className="text-border">·</span>
        <span>Stock {product.productStock}</span>
      </div>
    </div>
  );
}

function ProductFilterChip({
  product,
  count,
  active,
  onToggle,
}: {
  product: BoardProduct;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition',
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface text-text hover:bg-surface-muted',
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: productColor(product.productId) }}
      />
      {product.productName}
      <span className="text-text-muted">{count}</span>
    </button>
  );
}

function ConnectionBadge({ status }: { status: SseStatus }) {
  const config: Record<SseStatus, { label: string; dot: string; text: string } | null> = {
    idle: null,
    open: { label: 'Live', dot: 'bg-success', text: 'text-success' },
    connecting: { label: 'Connecting…', dot: 'bg-warning', text: 'text-text-muted' },
    error: { label: 'Reconnecting…', dot: 'bg-danger', text: 'text-danger' },
  };
  const current = config[status];
  if (!current) return null;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', current.text)}>
      <span
        className={cn('h-2 w-2 rounded-full', current.dot, status !== 'open' && 'animate-pulse')}
      />
      {current.label}
    </span>
  );
}

function LoadingBoard() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }).map((_, column) => (
        <div key={column} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="h-20 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatePanel({ message, title }: { message: string; title: string }) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">{message}</p>
    </section>
  );
}

// Stable per-product accent color derived from the product id, so a product keeps
// the same color across renders without the backend sending one.
const PRODUCT_PALETTE = [
  '#eab308', // yellow
  '#ec4899', // pink
  '#a855f7', // purple
  '#f97316', // orange
  '#10b981', // emerald
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#ef4444', // red
  '#8b5cf6', // violet
  '#14b8a6', // teal
];

function productColor(productId: string): string {
  let hash = 0;
  for (let i = 0; i < productId.length; i += 1) {
    hash = (hash * 31 + productId.charCodeAt(i)) | 0;
  }
  return PRODUCT_PALETTE[Math.abs(hash) % PRODUCT_PALETTE.length];
}
