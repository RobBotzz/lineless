import { Router, type Request, type Response } from "express";
import { validateBody } from "../../middleware/validate";
import {
  advanceOrderItem,
  assertActiveCashierStand,
  cancelOrderForOrganizer,
  cancelOrderItemsForOrganizer,
  cancelPendingOrder,
  confirmCashPayment,
  deleteUnpaidOrder,
  enrichOrderForAttendee,
  getOrderForAttendee,
  getOrderForCashier,
  getOrderForOrganizer,
  listOrdersForAttendee,
  listRefundableCashOrders,
  listUnpaidCashOrdersForEvent,
  refundCashOrderItems,
  resolveCashierEventId,
  submitOrder,
} from "./service";
import { SseConnection } from "../../lib/sse";
import { subscribe } from "../../lib/realtimeBus";
import type { OrderDoc } from "./model";
import {
  CashierDisabledError,
  CashPaymentNotFoundError,
  CashRefundExceedsTotalError,
  CashRefundInvalidItemsError,
  EventNotActiveError,
  InsufficientStockError,
  OrderAlreadyPaidError,
  OrderConflictRetryError,
  OrderItemNotFoundError,
  OrderItemStateError,
  OrderNotFoundError,
  OrderRequestCancelledError,
  OrderRequestDeletedError,
  OrderValidationError,
  StandNotFoundError,
} from "./errors";
import { EventNotFoundError } from "../events/errors";
import {
  cancelOrderItemsSchema,
  confirmCashPaymentSchema,
  createOrderSchema,
  refundByItemsSchema,
} from "./types";
import {
  authAttendee,
  authOrganizer,
  authOperator,
  authOperatorOrAttendee,
  authOrganizerOrOperator,
  authOrganizerOrOperatorOrAttendee,
} from "../../middleware/auth/guards";

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function itemId(req: Request): string {
  return req.params["itemId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof InsufficientStockError) {
    return res.status(409).json({
      code: "INSUFFICIENT_STOCK",
      error: err.message,
      shortages: err.shortages,
    });
  }
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof OrderNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof OrderItemNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof EventNotActiveError)
    return res.status(409).json({ error: err.message });
  if (err instanceof OrderRequestDeletedError)
    return res.status(409).json({
      code: "ORDER_REQUEST_DELETED",
      error: err.message,
    });
  if (err instanceof OrderRequestCancelledError)
    return res.status(409).json({
      code: "ORDER_REQUEST_CANCELLED",
      error: err.message,
    });
  if (err instanceof OrderValidationError)
    return res.status(400).json({ error: err.message });
  if (err instanceof CashierDisabledError)
    return res.status(403).json({ error: err.message });
  if (err instanceof OrderAlreadyPaidError)
    return res.status(409).json({ error: err.message });
  if (err instanceof OrderConflictRetryError)
    return res.status(409).json({
      code: "ORDER_CONFLICT_RETRY",
      error: err.message,
    });
  if (err instanceof OrderItemStateError)
    return res.status(409).json({ error: err.message });
  if (err instanceof CashPaymentNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof CashRefundExceedsTotalError)
    return res.status(422).json({ error: err.message });
  if (err instanceof CashRefundInvalidItemsError)
    return res.status(409).json({ error: err.message });
  console.error("Orders error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// =============================================================================
// Orders routes — mounted at /api/orders
// =============================================================================
export const ordersRouter = Router();

// POST /orders — submit an order (attendee or operator/cashier). Tab orders that
// exceed the authorized hold return 402 with a client secret for the new hold.
ordersRouter.post(
  "/",
  authOperatorOrAttendee,
  validateBody(createOrderSchema, async (req, res, data) => {
    try {
      const sessionId = req.attendee?.sessionId ?? null;
      const result = await submitOrder(sessionId, data, req.operator?.standId);
      if (result.status === 402) {
        return res
          .status(402)
          .json({ clientSecret: result.clientSecret, orderId: result.orderId });
      }
      return res.status(201).json({ order: result.order });
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /orders/:orderId/cash-payment — operator/cashier confirms cash received.
ordersRouter.post(
  "/:orderId/cash-payment",
  authOrganizerOrOperator,
  validateBody(confirmCashPaymentSchema, async (req, res) => {
    try {
      const order = await confirmCashPayment(
        orderId(req),
        req.organizer
          ? { organizerAccountId: req.organizer.accountId }
          : { operatorStandId: req.operator!.standId }
      );
      return res.status(201).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /orders/:orderId/refund — cashier refunds specific cancelled items of a
// cash-paid order. Item-level so an item can never be refunded twice.
ordersRouter.post(
  "/:orderId/refund",
  authOrganizerOrOperator,
  validateBody(refundByItemsSchema, async (req, res, data) => {
    try {
      const order = await refundCashOrderItems(
        orderId(req),
        data.itemIds,
        req.organizer
          ? { organizerAccountId: req.organizer.accountId }
          : { operatorStandId: req.operator!.standId }
      );
      return res.status(201).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// POST /orders/:orderId/cancel-pending-authorization — attendee abandons an
// order still awaiting authorization (cancels its gated items and releases any
// backing hold). Repeating a completed cleanup is idempotent.
ordersRouter.post(
  "/:orderId/cancel-pending-authorization",
  authAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = await cancelPendingOrder(
        orderId(req),
        req.attendee!.sessionId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// GET /orders/cashier/stream — same unpaid-orders list, pushed live over SSE on
// every relevant order.changed event (new cash order, cashier cancellation, or
// payment confirmation removing an order from the list). Mirrors the shape of
// /operator/board/stream.
ordersRouter.get(
  "/cashier/stream",
  authOperator,
  async (req: Request, res: Response) => {
    const standId = req.operator!.standId;
    try {
      // Resolve the stand before the SSE headers go out, so a bad/disabled
      // stand still maps to a clean error instead of a half-open stream.
      const stand = await assertActiveCashierStand(standId);
      const sse = new SseConnection(res);

      // Serialize the full-list queries the same way the pickup-board stream
      // does (see createQueuedSnapshotSender-style closed guard there): an
      // event arriving mid-query only marks the connection queued and re-runs
      // once the in-flight query settles, and `closed` is set synchronously
      // the moment we decide to end the connection so no later trigger (an
      // order.changed event or the recheck timer) can ever call sse.send()
      // after res.end() — writing to an ended response throws asynchronously,
      // as an unhandled error that would crash the whole process.
      let inFlight = false;
      let queued = false;
      let closed = false;
      const pushSnapshot = (): void => {
        if (closed) return;
        if (inFlight) {
          queued = true;
          return;
        }
        inFlight = true;
        void (async () => {
          // Re-verify on every push, not just at connect time — the stand/event
          // can go inactive (e.g. the organizer stops the event) with no
          // order.changed event to notify us, so this is the only way a
          // long-lived connection ever notices.
          await assertActiveCashierStand(standId);
          const orders = await listUnpaidCashOrdersForEvent(stand.eventId);
          if (!closed) sse.send("snapshot", orders);
        })()
          .catch((err) => {
            // Any failure — a transient DB error or the stand/event no longer
            // being active — means the client can no longer trust its current
            // view. Closing (and never sending again) lets its SSE hook
            // reconnect with backoff: a fresh connection either gets a correct
            // snapshot or the same clean 403 a connection attempt against an
            // inactive stand would get.
            console.error("Cashier stream snapshot refresh failed:", err);
            closed = true;
            queued = false;
            res.end();
          })
          .finally(() => {
            inFlight = false;
            if (!closed && queued) {
              queued = false;
              pushSnapshot();
            }
          });
      };

      // Register the listener before the first query so an event in the startup
      // window is not missed — it just coalesces into the next snapshot.
      const unsubscribe = subscribe("order.changed", (order) => {
        if (order.eventId !== stand.eventId || order.tabId !== null) return;
        pushSnapshot();
      });

      // Catches the event/stand going inactive with no order.changed to notify
      // us (e.g. the organizer stops the event without touching any cash orders).
      const recheckTimer = setInterval(pushSnapshot, 20_000);

      pushSnapshot();
      sse.onClose(() => {
        closed = true;
        clearInterval(recheckTimer);
        unsubscribe();
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// GET /orders/cashier/refundable — cash-paid orders for the cashier's event that
// still have at least one refundable (cancelled, not-yet-refunded) item.
ordersRouter.get(
  "/cashier/refundable",
  authOperator,
  async (req: Request, res: Response) => {
    try {
      const eventId = await resolveCashierEventId(req.operator!.standId);
      const orders = await listRefundableCashOrders(eventId);
      return res.status(200).json(orders);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// GET /orders — an attendee's own paid orders (order-status / review entry point).
ordersRouter.get("/", authAttendee, async (req: Request, res: Response) => {
  try {
    const orders = await listOrdersForAttendee(req.attendee!.sessionId);
    return res.status(200).json(orders);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /orders/stream — live order updates for the attendee over SSE.
// Registered before /:orderId so "stream" is not treated as an id.
ordersRouter.get(
  "/stream",
  authAttendee,
  async (req: Request, res: Response) => {
    const sessionId = req.attendee!.sessionId;
    // Mirrors the event-control-center streams: a plain res-level "close"
    // listener registered before anything async, so a disconnect during the
    // snapshot query is caught and cleaned up without needing an SseConnection
    // (and its headers/heartbeat) yet. requestClosed is checked right after
    // the await, before touching `res` again — writing to (or ending) a
    // response the client already closed either throws asynchronously as an
    // unhandled error (write) or corrupts an in-flight SSE stream (a JSON
    // error body after text/event-stream headers), so neither branch may run
    // once the client is gone.
    let unsubscribe: (() => void) | undefined;
    let requestClosed = false;
    const handleEarlyClose = (): void => {
      requestClosed = true;
      unsubscribe?.();
    };
    res.once("close", handleEarlyClose);

    try {
      let ready = false;
      const buffered: OrderDoc[] = [];

      // Declared before `sse` exists — only ever invoked once `ready` flips
      // true, by which point `sse` below has been assigned.
      function emit(order: OrderDoc) {
        void enrichOrderForAttendee(order)
          .then((enriched) => sse.send("order", enriched))
          .catch(() => {
            // enrichment errors are non-fatal; the client recovers on reconnect
          });
      }

      // Register the listener before reading the snapshot so an event in the
      // startup window is not lost. Deltas that arrive before the snapshot is
      // sent are buffered and flushed afterwards, preserving snapshot-first
      // ordering (the client also de-dupes by updatedAt, so a repeat is safe).
      unsubscribe = subscribe("order.changed", (order) => {
        if (order.sessionId !== sessionId) return;
        // Cash orders (tabId null) stream regardless of paidAt, so the
        // pending-payment page sees a cashier confirmation or cancellation
        // live. Unpaid card orders (mid-Stripe-authorization) are still
        // dropped — the attendee UI doesn't act on that noise.
        if (!order.paidAt && order.tabId !== null) return;
        if (!ready) {
          buffered.push(order);
          return;
        }
        emit(order);
      });

      const initial = await listOrdersForAttendee(sessionId);
      if (requestClosed) return;

      const sse = new SseConnection(res);
      sse.send("snapshot", initial);
      ready = true;
      buffered.forEach(emit);
      buffered.length = 0;

      sse.onClose(() => unsubscribe?.());
      res.off("close", handleEarlyClose);
    } catch (err) {
      res.off("close", handleEarlyClose);
      unsubscribe?.();
      if (requestClosed) return;
      handleError(err, res);
    }
  }
);

// GET /orders/:orderId — fetch a single order by ID (organizer, attendee, or a
// cashier operator collecting a cash payment for an order in its event).
ordersRouter.get(
  "/:orderId",
  authOrganizerOrOperatorOrAttendee,
  async (req: Request, res: Response) => {
    try {
      const order = req.organizer
        ? await getOrderForOrganizer(orderId(req), req.organizer.accountId)
        : req.operator
          ? await getOrderForCashier(orderId(req), req.operator.standId)
          : await getOrderForAttendee(orderId(req), req.attendee!.sessionId);
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/cancel — organizer cancels all not-ready order items.
ordersRouter.post(
  "/:orderId/cancel",
  authOrganizer,
  async (req: Request, res: Response) => {
    try {
      const order = await cancelOrderForOrganizer(
        orderId(req),
        req.organizer!.accountId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// POST /orders/:orderId/items/cancel — organizer cancels selected order items.
ordersRouter.post(
  "/:orderId/items/cancel",
  authOrganizer,
  validateBody(cancelOrderItemsSchema, async (req, res, data) => {
    try {
      const order = await cancelOrderItemsForOrganizer(
        orderId(req),
        data.itemIds,
        req.organizer!.accountId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

function itemTransition(action: "start" | "ready" | "fulfill" | "cancel") {
  return async (req: Request, res: Response): Promise<unknown> => {
    try {
      const order = await advanceOrderItem(
        orderId(req),
        itemId(req),
        action,
        req.operator!.standId
      );
      return res.status(200).json(order);
    } catch (err) {
      return handleError(err, res);
    }
  };
}

// POST /orders/:orderId/items/:itemId/{start|ready|fulfill|cancel} — operator
// drives the item state machine (PENDING → PREPARING → READY → FULFILLED, or cancel).
ordersRouter.post(
  "/:orderId/items/:itemId/start",
  authOperator,
  itemTransition("start")
);
ordersRouter.post(
  "/:orderId/items/:itemId/ready",
  authOperator,
  itemTransition("ready")
);
ordersRouter.post(
  "/:orderId/items/:itemId/fulfill",
  authOperator,
  itemTransition("fulfill")
);
ordersRouter.post(
  "/:orderId/items/:itemId/cancel",
  authOperator,
  itemTransition("cancel")
);

// DELETE /orders/cashier/:orderId — soft-delete an unpaid cash order.
// Must be registered before /:orderId to avoid Express route shadowing.
ordersRouter.delete(
  "/cashier/:orderId",
  authOperator,
  async (req: Request, res: Response) => {
    try {
      await deleteUnpaidOrder(
        req.params["orderId"] as string,
        req.operator!.standId
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res);
    }
  }
);
