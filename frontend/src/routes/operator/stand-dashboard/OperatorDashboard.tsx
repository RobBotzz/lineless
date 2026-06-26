import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { OPERATOR_BOARD_EVENT, OPERATOR_BOARD_STREAM_PATH } from '@/api/operatorBoard';
import { fulfillOrderItem, readyOrderItem, startOrderItem } from '@/api/orders';
import { pauseProductAsOperator, resumeProductAsOperator } from '@/api/products';
import { useSSE, type SseStatus } from '@/hooks/useSSE';
import { cn } from '@/lib/utils';
import { paths } from '@/paths';
import {
  isOperatorBoard,
  type BoardItem,
  type BoardItemState,
  type BoardProduct,
  type OperatorBoard,
} from '@/types/operatorBoard';
import { BackButton } from '@/components/shared';
import { ChatIcon, ChevronDownIcon, PauseIcon, PlayIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { operatorStandQueryOptions } from '../operatorQueries';

// Each board column maps a state to the transition that advances an item out of it.
type ColumnTransition = (orderId: string, itemId: string, standId: string) => Promise<void>;

interface ColumnConfig {
  state: BoardItemState;
  title: string;
  action: ColumnTransition;
  actionLabel: string;
  dotClassName: string;
  // Tinted strip behind the column header, keyed to the column's state color.
  headerClassName: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    state: 'PENDING',
    title: 'To Do',
    action: startOrderItem,
    actionLabel: 'Start',
    dotClassName: 'bg-text-muted',
    headerClassName: 'bg-surface-muted text-text',
  },
  {
    state: 'PREPARING',
    title: 'In Progress',
    action: readyOrderItem,
    actionLabel: 'Report ready',
    dotClassName: 'bg-accent',
    headerClassName: 'bg-accent-soft text-accent',
  },
  {
    state: 'READY',
    title: 'Ready',
    action: fulfillOrderItem,
    actionLabel: 'Pick up',
    dotClassName: 'bg-success',
    headerClassName: 'bg-success/10 text-success',
  },
];

const ACTION_ERROR = 'Could not update the item. It may have moved already — try again.';
const PAUSE_ERROR = 'Could not change the product. Please try again.';
// How long a card keeps its move glow after changing column (matches the
// board-card-glow animation in index.css).
const MOVE_HIGHLIGHT_MS = 5000;

// A new set with the given keys removed (no-op if there are none).
function withoutKeys(set: ReadonlySet<string>, keys: readonly string[]): ReadonlySet<string> {
  if (keys.length === 0) return set;
  const next = new Set(set);
  keys.forEach((key) => next.delete(key));
  return next;
}

export default function OperatorDashboard() {
  const { eventId, standId } = useParams();
  const standQuery = useQuery(operatorStandQueryOptions(standId));

  const [board, setBoard] = useState<OperatorBoard | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [filters, setFilters] = useState<ReadonlySet<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  // The item awaiting pickup-code confirmation before it is handed over.
  const [confirmItem, setConfirmItem] = useState<BoardItem | null>(null);
  // The product whose pause/resume dialog is open — UI state only; the request's
  // in-flight + error state lives in pauseMutation below.
  const [pauseTarget, setPauseTarget] = useState<BoardProduct | null>(null);
  // Items that just changed column (brief move shimmer) and items whose comment
  // should auto-open after a To Do -> In Progress move. Both live at dashboard
  // level: a card unmounts/remounts when it changes column, so per-card state
  // wouldn't survive the move. Moves are detected by diffing consecutive frames.
  const [recentlyMoved, setRecentlyMoved] = useState<ReadonlySet<string>>(() => new Set());
  const [autoOpenComment, setAutoOpenComment] = useState<ReadonlySet<string>>(() => new Set());
  const prevItemStatesRef = useRef<Map<string, BoardItemState>>(new Map());
  const moveTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => moveTimersRef.current.forEach(clearTimeout), []);

  // The stream pushes a fresh full board on every change (and as its first frame),
  // so we just replace local state — no client-side merging of transition responses.
  const handleMessage = useCallback(({ event, data }: { event: string; data: unknown }) => {
    if (event !== OPERATOR_BOARD_EVENT) return;
    // `data` arrives as unknown over the wire — validate its shape before trusting
    // it. A malformed/partial/error frame is dropped, keeping the last good board,
    // so it can never be stored and crash a later board.items access.
    if (!isOperatorBoard(data)) {
      console.warn('Ignoring malformed operator board frame', data);
      return;
    }

    // Diff against the previous frame to flag items that changed column. Detection
    // runs here (not in an effect) so the flags are set in the same batch as the
    // board — the card then mounts in its new column already carrying them.
    const prev = prevItemStatesRef.current;
    prevItemStatesRef.current = new Map(data.items.map((item) => [item.itemId, item.state]));
    if (prev.size > 0) {
      const moved: string[] = [];
      const openComment: string[] = [];
      for (const item of data.items) {
        const before = prev.get(item.itemId);
        if (before === undefined || before === item.state) continue; // new or unchanged
        moved.push(item.itemId);
        if (before === 'PENDING' && item.state === 'PREPARING' && item.customerComment?.trim()) {
          openComment.push(item.itemId);
        }
      }
      if (moved.length > 0) {
        setRecentlyMoved((cur) => new Set([...cur, ...moved]));
        if (openComment.length > 0) setAutoOpenComment((cur) => new Set([...cur, ...openComment]));
        const timer = setTimeout(() => {
          setRecentlyMoved((cur) => withoutKeys(cur, moved));
          setAutoOpenComment((cur) => withoutKeys(cur, openComment));
        }, MOVE_HIGHLIGHT_MS);
        moveTimersRef.current.push(timer);
      }
    }

    setBoard(data);
  }, []);

  const { status } = useSSE({
    path: standId ? OPERATOR_BOARD_STREAM_PATH : null,
    auth: 'operator',
    standId,
    onMessage: handleMessage,
  });

  const runTransition = useCallback(
    (item: BoardItem, column: ColumnConfig) => {
      if (!standId) return;
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
    [standId],
  );

  const advance = useCallback(
    (item: BoardItem) => {
      if (!standId || pending.has(item.itemId)) return;
      const column = COLUMNS.find((c) => c.state === item.state);
      if (!column) return;
      // Handing an item to the customer requires confirming the pickup code first.
      if (item.state === 'READY') {
        setConfirmItem(item);
        return;
      }
      runTransition(item, column);
    },
    [pending, runTransition, standId],
  );

  const confirmFulfill = useCallback(() => {
    if (!confirmItem) return;
    const column = COLUMNS.find((c) => c.state === confirmItem.state);
    if (column) runTransition(confirmItem, column);
    setConfirmItem(null);
  }, [confirmItem, runTransition]);

  // Stable identity so ModalOverlay's Escape listener isn't re-registered on every
  // re-render (e.g. each SSE frame) while the fulfill dialog is open.
  const closeConfirm = useCallback(() => setConfirmItem(null), []);

  // Multi-select board filter, driven by the top chips. Kept independent of
  // `board`, so it persists across SSE updates (moving an item never clears it).
  const toggleFilter = useCallback((productId: string) => {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);
  const clearFilters = useCallback(() => setFilters(new Set()), []);

  // Only one pause/resume runs at a time (it's a modal), so a single mutation
  // owns the in-flight + error state. The board itself updates over the SSE stream
  // (the backend re-pushes on every product change), so onSuccess only closes the
  // dialog — no client-side board write to keep in sync.
  const pauseMutation = useMutation({
    mutationFn: ({ product, standId }: { product: BoardProduct; standId: string }) => {
      const action =
        product.productStatus === 'LIVE' ? pauseProductAsOperator : resumeProductAsOperator;
      return action(product.productId, standId);
    },
    onSuccess: () => setPauseTarget(null),
  });

  const confirmPauseToggle = useCallback(() => {
    if (!standId || !pauseTarget || pauseMutation.isPending) return;
    pauseMutation.mutate({ product: pauseTarget, standId });
  }, [pauseMutation, pauseTarget, standId]);

  const closePauseDialog = useCallback(() => {
    if (pauseMutation.isPending) return;
    setPauseTarget(null);
    pauseMutation.reset();
  }, [pauseMutation]);

  const items = board?.items ?? [];
  const products = board?.products ?? [];
  // Color products by their position in the product list (not a hash of the id),
  // so the first PRODUCT_PALETTE.length products always get distinct colors. Built
  // per render rather than memoized: it's a tiny map, and `board` is a fresh object
  // on every SSE frame, so a memo keyed on it would rebuild anyway.
  const productColors = new Map(
    products.map((p, i) => [p.productId, PRODUCT_PALETTE[i % PRODUCT_PALETTE.length]]),
  );
  const colorOf = (productId: string) => productColors.get(productId) ?? PRODUCT_PALETTE[0];
  const visibleItems =
    filters.size > 0 ? items.filter((item) => filters.has(item.productId)) : items;
  // The products overview is filtered the same way (it no longer drives the filter).
  const visibleProducts =
    filters.size > 0 ? products.filter((product) => filters.has(product.productId)) : products;
  const standName = standQuery.data?.standName;
  const pauseError = pauseMutation.error
    ? pauseMutation.error instanceof ApiError
      ? pauseMutation.error.message
      : PAUSE_ERROR
    : null;

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
        <header className="mb-5 flex items-center gap-3">
          <BackButton to={eventId ? paths.operator.root(eventId) : paths.home}>Back</BackButton>
          <h1 className="text-2xl font-bold tracking-tight text-text">{standName ?? 'Stand'}</h1>
          <ConnectionBadge status={status} />
        </header>

        {products.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {products.map((product) => (
              <ProductFilterChip
                key={product.productId}
                product={product}
                color={colorOf(product.productId)}
                count={items.filter((item) => item.productId === product.productId).length}
                active={filters.has(product.productId)}
                onToggle={() => toggleFilter(product.productId)}
              />
            ))}
            {filters.size > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm transition hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-11 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {actionError && (
          <div
            className="mb-4 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
            role="alert"
          >
            {actionError}
          </div>
        )}

        {/* Board (the work) on the left; the products catalog/controls on the right.
            On tablet and below the rail drops under the board as a responsive grid. */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COLUMNS.map((column) => (
              <BoardColumn
                key={column.state}
                column={column}
                items={visibleItems.filter((item) => item.state === column.state)}
                pending={pending}
                onAdvance={advance}
                colorOf={colorOf}
                recentlyMoved={recentlyMoved}
                autoOpenComment={autoOpenComment}
              />
            ))}
          </div>

          <ProductsOverview
            className="xl:w-72 xl:shrink-0"
            products={visibleProducts}
            colorOf={colorOf}
            onRequestPause={(product) => {
              pauseMutation.reset();
              setPauseTarget(product);
            }}
          />
        </div>
      </div>

      {confirmItem && (
        <FulfillDialog item={confirmItem} onConfirm={confirmFulfill} onCancel={closeConfirm} />
      )}

      {pauseTarget && (
        <PauseProductDialog
          product={pauseTarget}
          pending={pauseMutation.isPending}
          error={pauseError}
          onConfirm={confirmPauseToggle}
          onCancel={closePauseDialog}
        />
      )}
    </div>
  );
}

function BoardColumn({
  column,
  items,
  pending,
  onAdvance,
  colorOf,
  recentlyMoved,
  autoOpenComment,
}: {
  column: ColumnConfig;
  items: BoardItem[];
  pending: ReadonlySet<string>;
  onAdvance: (item: BoardItem) => void;
  colorOf: (productId: string) => string;
  recentlyMoved: ReadonlySet<string>;
  autoOpenComment: ReadonlySet<string>;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div
        className={cn(
          'mb-3 flex items-center justify-between rounded-md px-3 py-2',
          column.headerClassName,
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', column.dotClassName)} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{column.title}</h2>
        </div>
        <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-xs font-bold text-text">
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
              color={colorOf(item.productId)}
              pending={pending.has(item.itemId)}
              highlight={recentlyMoved.has(item.itemId)}
              defaultCommentOpen={autoOpenComment.has(item.itemId)}
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
  color,
  pending,
  highlight,
  defaultCommentOpen,
  onAdvance,
}: {
  item: BoardItem;
  actionLabel: string;
  color: string;
  pending: boolean;
  highlight: boolean;
  defaultCommentOpen: boolean;
  onAdvance: () => void;
}) {
  const comment = item.customerComment?.trim() || null;
  // Initialised from defaultCommentOpen so an item that just moved To Do ->
  // In Progress mounts in its new column with the comment already expanded.
  const [commentOpen, setCommentOpen] = useState(defaultCommentOpen);

  return (
    <div
      style={{ borderLeftColor: color }}
      className={cn(
        'group relative rounded-md border border-border border-l-4 bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        pending && 'opacity-60',
        highlight && 'board-card-moved',
      )}
    >
      {/* Stretched advance button sits behind the content so the whole card is
          tappable, while the comment row stays independently clickable. */}
      <button
        type="button"
        disabled={pending}
        onClick={onAdvance}
        aria-label={`Order ${item.orderNumber} — ${actionLabel}`}
        className="absolute inset-0 z-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-wait"
      />

      <div className="pointer-events-none relative z-10 p-3">
        <span className="block break-words text-base font-bold leading-tight text-text">
          {item.productName}
        </span>
        <span className="mt-1.5 block text-xs font-medium text-text-muted">
          #{item.orderNumber}
        </span>
      </div>

      {/* Collapsible customer comment, like the cart's note row. Lives above the
          stretched advance button (pointer-events-auto) so tapping it toggles the
          note instead of advancing the item. */}
      {comment && (
        <div className="pointer-events-auto relative z-10 border-t border-border">
          <button
            type="button"
            onClick={() => setCommentOpen((open) => !open)}
            aria-expanded={commentOpen}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted transition-colors hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChatIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Customer comment</span>
            <ChevronDownIcon
              className={cn('ml-auto h-4 w-4 transition-transform', commentOpen && 'rotate-180')}
            />
          </button>
          {commentOpen && (
            <p className="whitespace-pre-wrap break-words px-3 pb-2.5 text-sm leading-5 text-text">
              {comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Shared modal scaffold. Rendered through a portal to document.body so the fixed
// overlay can never be trapped by an ancestor's transform — a board card uses a
// hover translate, and on touch that hover state sticks, which previously pinned
// the overlay inside the card so taps outside it (and re-taps) failed to close it.
function ModalOverlay({
  onClose,
  labelledBy,
  dismissable = true,
  className,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  dismissable?: boolean;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={dismissable ? onClose : undefined}
    >
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        role="dialog"
        className={cn(
          'w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.2)]',
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

function FulfillDialog({
  item,
  onConfirm,
  onCancel,
}: {
  item: BoardItem;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalOverlay onClose={onCancel} labelledBy="fulfill-dialog-title">
      <div className="text-center">
        <h2 id="fulfill-dialog-title" className="text-xl font-semibold text-text">
          Confirm handoff
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Match this code with the customer before handing over order #{item.orderNumber}.
        </p>

        <div className="mt-5 rounded-lg border border-border bg-background py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Pickup code
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-text">
            {item.pickupCode || '—'}
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button className="flex-1" onClick={onCancel} size="lg" variant="secondary">
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} size="lg">
            Confirm
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function PauseProductDialog({
  product,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  product: BoardProduct;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const resuming = product.productStatus === 'PAUSED';
  return (
    <ModalOverlay onClose={onCancel} labelledBy="pause-dialog-title" dismissable={!pending}>
      <div className="text-center">
        <span
          className={cn(
            'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
            resuming ? 'bg-success/15 text-success' : 'bg-warning/20 text-text',
          )}
        >
          {resuming ? <PlayIcon className="h-6 w-6" /> : <PauseIcon className="h-6 w-6" />}
        </span>
        <h2 id="pause-dialog-title" className="mt-4 text-xl font-semibold text-text">
          {resuming ? 'Resume' : 'Pause'} {product.productName}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {resuming
            ? `${product.productName} will be available to order again.`
            : `Customers won’t be able to order ${product.productName} until you resume it. Items already in progress are not affected.`}
        </p>

        {error && (
          <div
            className="mt-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm font-medium text-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            onClick={onCancel}
            size="lg"
            variant="secondary"
            disabled={pending}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} size="lg" disabled={pending}>
            {pending ? (resuming ? 'Resuming…' : 'Pausing…') : resuming ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ProductsOverview({
  products,
  colorOf,
  onRequestPause,
  className,
}: {
  products: BoardProduct[];
  colorOf: (productId: string) => string;
  onRequestPause: (product: BoardProduct) => void;
  className?: string;
}) {
  // Reflects the products shown — when a filter is active these are only the
  // selected ones, so the count stays consistent with the rows below.
  const openCount = products.reduce((sum, product) => sum + product.openToDo, 0);
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-border bg-surface p-3 shadow-sm',
        className,
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Products</h2>
        <span className="text-xs font-semibold text-text-muted">
          {openCount} open item{openCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* One column inside the narrow xl rail; a responsive grid when the section
          drops under the board on tablet/desktop-narrow so rows don't stretch wide. */}
      <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
        {products.length > 0 ? (
          products.map((product) => (
            <ProductSummaryRow
              key={product.productId}
              product={product}
              color={colorOf(product.productId)}
              onRequestPause={() => onRequestPause(product)}
            />
          ))
        ) : (
          <p className="col-span-full rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text-muted">
            No products configured.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductSummaryRow({
  product,
  color,
  onRequestPause,
}: {
  product: BoardProduct;
  color: string;
  onRequestPause: () => void;
}) {
  const paused = product.productStatus === 'PAUSED';
  const terminated = product.productStatus === 'TERMINATED';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background',
        product.productStatus !== 'LIVE' && 'opacity-80',
      )}
    >
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold leading-tight text-text">
            {product.productName}
          </span>
        </div>

        {/* Meta and the action share one row to keep cards short when there are
            many products. On a narrow column (e.g. a 1024px landscape tablet) the
            meta wraps as whole units (min-w-0 + flex-wrap) so the shrink-0 button
            never gets pushed out of the card. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-text-muted">
            <span className="rounded bg-surface-muted px-1.5 py-0.5 font-semibold text-text">
              {product.openToDo}
            </span>
            <span className="whitespace-nowrap">To Do</span>
            <span className="whitespace-nowrap">· Stock {product.productStock}</span>
          </div>

          {/* Terminated is terminal — no pause/resume action; show a status label
              in the control's place instead of a button. */}
          {terminated ? (
            <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-border px-2.5 text-xs font-semibold text-text-muted">
              Terminated
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestPause}
              aria-label={paused ? `Resume ${product.productName}` : `Pause ${product.productName}`}
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                paused
                  ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                  : 'border-warning/50 bg-warning/20 text-text hover:bg-warning/40',
              )}
            >
              {paused ? (
                <PlayIcon className="h-3.5 w-3.5" />
              ) : (
                <PauseIcon className="h-3.5 w-3.5" />
              )}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductFilterChip({
  product,
  color,
  count,
  active,
  onToggle,
}: {
  product: BoardProduct;
  color: string;
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
        // Comfortable size on tablet and up; only slightly more compact on small
        // mobile viewports (below the sm breakpoint).
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-11 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface text-text hover:bg-surface-muted',
      )}
    >
      <span className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5" style={{ backgroundColor: color }} />
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
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, column) => (
        <div key={column} className="rounded-lg border border-border bg-surface p-3 shadow-sm">
          <div className="mb-3 h-9 w-full animate-pulse rounded-md bg-surface-muted" />
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

// Per-product accent colors, assigned by position in the board's product list
// (see colorOf) so products always get distinct colors. Uses the D3 "category10"
// categorical palette — engineered for maximally distinguishable categories
// (varied hue AND lightness, plus brown/grey), which reads clearly even at the
// small swatch sizes used here (dots and the 4px card border).
const PRODUCT_PALETTE = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#17becf', // cyan
  '#bcbd22', // olive
  '#7f7f7f', // grey
];
