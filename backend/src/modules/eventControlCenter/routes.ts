import { Router, type Request } from "express";
import { validateBody, validateQuery } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import { subscribe } from "../../lib/realtimeBus";
import { SseConnection } from "../../lib/sse";
import {
  getEventControlCenter,
  listLiveOrdersForEventControlCenter,
} from "./service";
import {
  cancelOrderForOrganizer,
  cancelOrderItemsForOrganizer,
} from "../orders/service";
import {
  pauseProductForEventControlCenter,
  resumeProductForEventControlCenter,
} from "../products/service";
import {
  cancelOrderItemsSchema,
  eventControlCenterQuerySchema,
  liveOrdersQuerySchema,
} from "./types";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function orderId(req: Request): string {
  return req.params["orderId"] as string;
}

function standId(req: Request): string {
  return req.params["standId"] as string;
}

function productId(req: Request): string {
  return req.params["productId"] as string;
}

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function createQueuedSnapshotSender<T>(
  loadSnapshot: () => Promise<T>,
  sendSnapshot: (snapshot: T) => void,
  logLabel: string
): { send: () => void; close: () => void } {
  let inFlight = false;
  let queued = false;
  let closed = false;

  const send = (): void => {
    if (closed) return;
    if (inFlight) {
      queued = true;
      return;
    }

    inFlight = true;
    void loadSnapshot()
      .then((snapshot) => {
        if (!closed) sendSnapshot(snapshot);
      })
      .catch((err) => console.error(`${logLabel} stream error:`, err))
      .finally(() => {
        inFlight = false;
        if (!closed && queued) {
          queued = false;
          send();
        }
      });
  };

  return {
    send,
    close: () => {
      closed = true;
      queued = false;
    },
  };
}

export const eventControlCenterRouter = Router({ mergeParams: true });

// GET /events/:eventId/event-control-center — organizer-only event control center data.
eventControlCenterRouter.get(
  "/",
  authOrganizer,
  validateQuery(eventControlCenterQuerySchema, async (req, res, query) => {
    const snapshot = await getEventControlCenter(
      eventId(req),
      accountId(req),
      query
    );
    res.status(200).json(snapshot);
  })
);

// GET /events/:eventId/event-control-center/stream — same snapshot over SSE.
eventControlCenterRouter.get(
  "/stream",
  authOrganizer,
  validateQuery(eventControlCenterQuerySchema, async (req, res, query) => {
    const targetEventId = eventId(req);
    const organizerAccountId = accountId(req);

    try {
      const loadSnapshot = () =>
        getEventControlCenter(targetEventId, organizerAccountId, query);
      const initial = await loadSnapshot();

      const sse = new SseConnection(res);
      sse.send("control-center", initial);

      const sendLatest = createQueuedSnapshotSender(
        loadSnapshot,
        (snapshot) => sse.send("control-center", snapshot),
        "Event control center"
      );
      const unsubscribe = subscribe("order.changed", (order) => {
        if (order.eventId !== targetEventId) return;
        sendLatest.send();
      });
      const refreshInterval = setInterval(sendLatest.send, 60_000);

      sse.onClose(() => {
        sendLatest.close();
        clearInterval(refreshInterval);
        unsubscribe();
      });
    } catch (err) {
      console.error("Event control center stream error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  })
);

// POST /events/:eventId/event-control-center/orders/:orderId/cancel
// Order change streams publish the resulting order update to SSE subscribers.
eventControlCenterRouter.post(
  "/orders/:orderId/cancel",
  authOrganizer,
  async (req, res) => {
    const order = await cancelOrderForOrganizer(
      eventId(req),
      orderId(req),
      accountId(req)
    );
    res.status(200).json(order);
  }
);

// POST /events/:eventId/event-control-center/orders/:orderId/items/cancel
// Order change streams publish the resulting order update to SSE subscribers.
eventControlCenterRouter.post(
  "/orders/:orderId/items/cancel",
  authOrganizer,
  validateBody(cancelOrderItemsSchema, async (req, res, data) => {
    const order = await cancelOrderItemsForOrganizer(
      eventId(req),
      orderId(req),
      data.itemIds,
      accountId(req)
    );
    res.status(200).json(order);
  })
);

// GET /events/:eventId/event-control-center/orders — live, paid, unfulfilled orders.
eventControlCenterRouter.get(
  "/orders",
  authOrganizer,
  validateQuery(liveOrdersQuerySchema, async (req, res, query) => {
    const orders = await listLiveOrdersForEventControlCenter(
      eventId(req),
      accountId(req),
      query
    );
    res.status(200).json(orders);
  })
);

// GET /events/:eventId/event-control-center/orders/stream — live orders over SSE.
eventControlCenterRouter.get(
  "/orders/stream",
  authOrganizer,
  validateQuery(liveOrdersQuerySchema, async (req, res, query) => {
    const targetEventId = eventId(req);
    const organizerAccountId = accountId(req);

    try {
      const loadSnapshot = () =>
        listLiveOrdersForEventControlCenter(
          targetEventId,
          organizerAccountId,
          query
        );
      const initial = await loadSnapshot();

      const sse = new SseConnection(res);
      sse.send("orders", initial);

      const sendLatest = createQueuedSnapshotSender(
        loadSnapshot,
        (orders) => sse.send("orders", orders),
        "Event control center orders"
      );
      const unsubscribe = subscribe("order.changed", (order) => {
        if (order.eventId !== targetEventId) return;
        sendLatest.send();
      });

      sse.onClose(() => {
        sendLatest.close();
        unsubscribe();
      });
    } catch (err) {
      console.error("Event control center orders stream error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  })
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/pause
// Product availability streams are intentionally separate from the order/KPI SSE surface.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/pause",
  authOrganizer,
  async (req, res) => {
    const product = await pauseProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  }
);

// POST /events/:eventId/event-control-center/stands/:standId/products/:productId/resume
// Product availability streams are intentionally separate from the order/KPI SSE surface.
eventControlCenterRouter.post(
  "/stands/:standId/products/:productId/resume",
  authOrganizer,
  async (req, res) => {
    const product = await resumeProductForEventControlCenter(
      eventId(req),
      standId(req),
      productId(req),
      accountId(req)
    );
    res.status(200).json(product);
  }
);
