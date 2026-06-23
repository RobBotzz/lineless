import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { validateQuery } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import { subscribe } from "../../lib/realtimeBus";
import { SseConnection } from "../../lib/sse";
import {
  getEventControlCenter,
  listLiveOrdersForEventControlCenter,
  standBelongsToEvent,
} from "./service";
import { EventNotFoundError } from "../events/errors";
import { eventControlCenterQuerySchema, liveOrdersQuerySchema } from "./types";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  console.error("Event control center error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

function eventControlCenterErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  handleError(err, res);
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
      const eventStandIds = new Set(
        initial.standRevenue.map((series) => series.standId)
      );
      const ignoredStandIds = new Set<string>();
      const unsubscribe = subscribe("order.changed", (order) => {
        if (order.eventId !== targetEventId) return;
        sendLatest.send();
      });
      const unsubscribeRatings = subscribe("rating.changed", (rating) => {
        if (rating.eventId !== targetEventId) return;
        sendLatest.send();
      });
      const unsubscribeProducts = subscribe("product.changed", (product) => {
        if (eventStandIds.has(product.standId)) {
          sendLatest.send();
          return;
        }
        if (ignoredStandIds.has(product.standId)) return;

        void standBelongsToEvent(targetEventId, product.standId)
          .then((belongsToEvent) => {
            if (!belongsToEvent) {
              ignoredStandIds.add(product.standId);
              return;
            }
            eventStandIds.add(product.standId);
            sendLatest.send();
          })
          .catch((err) =>
            console.error("Event control center product stream error:", err)
          );
      });
      const unsubscribeStands = subscribe("stand.changed", (stand) => {
        if (stand.eventId !== targetEventId) return;
        eventStandIds.add(stand._id);
        ignoredStandIds.delete(stand._id);
        sendLatest.send();
      });
      const refreshInterval = setInterval(sendLatest.send, 60_000);

      sse.onClose(() => {
        sendLatest.close();
        clearInterval(refreshInterval);
        unsubscribe();
        unsubscribeRatings();
        unsubscribeProducts();
        unsubscribeStands();
      });
    } catch (err) {
      handleError(err, res);
    }
  })
);

// GET /events/:eventId/event-control-center/orders — latest live, paid, unfulfilled orders.
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
      handleError(err, res);
    }
  })
);

eventControlCenterRouter.use(eventControlCenterErrorHandler);
