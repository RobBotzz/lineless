import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { validateBody, validateQuery } from "../../middleware/validate";
import { authOrganizer } from "../../middleware/auth/guards";
import { subscribe } from "../../lib/realtimeBus";
import { SseConnection } from "../../lib/sse";
import {
  getEventControlCenter,
  listLiveOrdersForEventControlCenter,
  standBelongsToEvent,
} from "./service";
import { EventNotFoundError } from "../events/errors";
import { StandNotFoundError } from "../stands/errors";
import {
  getEventControlCenterSettings,
  InvalidEventControlCenterSettingsError,
  replaceEventControlCenterSettings,
  resetEventControlCenterSettings,
} from "./settings.service";
import {
  eventControlCenterSettingsSchema,
  liveOrdersQuerySchema,
} from "./types";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function accountId(req: Request): string {
  return req.organizer!.accountId;
}

function handleError(err: unknown, res: Response): unknown {
  if (err instanceof EventNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof StandNotFoundError)
    return res.status(404).json({ error: err.message });
  if (err instanceof InvalidEventControlCenterSettingsError)
    return res.status(400).json({ error: err.message });
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

// GET /events/:eventId/event-control-center/settings — effective persisted thresholds.
eventControlCenterRouter.get("/settings", authOrganizer, async (req, res) => {
  try {
    const settings = await getEventControlCenterSettings(
      eventId(req),
      accountId(req)
    );
    return res.status(200).json(settings);
  } catch (err) {
    return handleError(err, res);
  }
});

// PUT /events/:eventId/event-control-center/settings — replace all thresholds atomically.
eventControlCenterRouter.put(
  "/settings",
  authOrganizer,
  validateBody(eventControlCenterSettingsSchema, async (req, res, settings) => {
    try {
      const saved = await replaceEventControlCenterSettings(
        eventId(req),
        accountId(req),
        settings
      );
      return res.status(200).json(saved);
    } catch (err) {
      return handleError(err, res);
    }
  })
);

// DELETE /events/:eventId/event-control-center/settings — reset to defaults.
eventControlCenterRouter.delete(
  "/settings",
  authOrganizer,
  async (req, res) => {
    try {
      const settings = await resetEventControlCenterSettings(
        eventId(req),
        accountId(req)
      );
      return res.status(200).json(settings);
    } catch (err) {
      return handleError(err, res);
    }
  }
);

// GET /events/:eventId/event-control-center — organizer-only event control center data.
eventControlCenterRouter.get("/", authOrganizer, async (req, res) => {
  const snapshot = await getEventControlCenter(eventId(req), accountId(req));
  res.status(200).json(snapshot);
});

// GET /events/:eventId/event-control-center/stream — same snapshot over SSE.
eventControlCenterRouter.get("/stream", authOrganizer, async (req, res) => {
  const targetEventId = eventId(req);
  const organizerAccountId = accountId(req);
  let cleanupSubscriptions: (() => void) | undefined;
  let requestClosed = false;
  const handleEarlyClose = (): void => {
    requestClosed = true;
    cleanupSubscriptions?.();
  };
  res.once("close", handleEarlyClose);

  try {
    const loadSnapshot = () =>
      getEventControlCenter(targetEventId, organizerAccountId);
    let refreshQueued = false;
    let sendLatest: { send: () => void; close: () => void } | null = null;
    const invalidateSnapshot = (): void => {
      if (sendLatest) {
        sendLatest.send();
        return;
      }
      refreshQueued = true;
    };

    const eventStandIds = new Set<string>();
    const ignoredStandIds = new Set<string>();
    const unsubscribe = subscribe("order.changed", (order) => {
      if (order.eventId !== targetEventId) return;
      invalidateSnapshot();
    });
    const unsubscribeRatings = subscribe("rating.changed", (rating) => {
      if (rating.eventId !== targetEventId) return;
      invalidateSnapshot();
    });
    const unsubscribeProducts = subscribe("product.changed", (product) => {
      if (eventStandIds.has(product.standId)) {
        invalidateSnapshot();
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
          invalidateSnapshot();
        })
        .catch((err) =>
          console.error("Event control center product stream error:", err)
        );
    });
    const unsubscribeStands = subscribe("stand.changed", (stand) => {
      if (stand.eventId !== targetEventId) return;
      eventStandIds.add(stand._id);
      ignoredStandIds.delete(stand._id);
      invalidateSnapshot();
    });
    const unsubscribeSettings = subscribe(
      "eventControlCenterSettings.changed",
      (settings) => {
        if (settings.eventId !== targetEventId) return;
        invalidateSnapshot();
      }
    );
    cleanupSubscriptions = () => {
      unsubscribe();
      unsubscribeRatings();
      unsubscribeProducts();
      unsubscribeStands();
      unsubscribeSettings();
    };

    const initial = await loadSnapshot();
    if (requestClosed) return;
    for (const series of initial.standRevenue) {
      eventStandIds.add(series.standId);
    }

    const sse = new SseConnection(res);
    sse.send("control-center", initial);

    sendLatest = createQueuedSnapshotSender(
      loadSnapshot,
      (snapshot) => sse.send("control-center", snapshot),
      "Event control center"
    );
    if (refreshQueued) {
      refreshQueued = false;
      sendLatest.send();
    }
    const refreshInterval = setInterval(invalidateSnapshot, 60_000);

    sse.onClose(() => {
      sendLatest?.close();
      clearInterval(refreshInterval);
      cleanupSubscriptions?.();
    });
    res.off("close", handleEarlyClose);
  } catch (err) {
    res.off("close", handleEarlyClose);
    cleanupSubscriptions?.();
    if (requestClosed) return;
    handleError(err, res);
  }
});

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
    let unsubscribe: (() => void) | undefined;
    let requestClosed = false;
    const handleEarlyClose = (): void => {
      requestClosed = true;
      unsubscribe?.();
    };
    res.once("close", handleEarlyClose);

    try {
      const loadSnapshot = () =>
        listLiveOrdersForEventControlCenter(
          targetEventId,
          organizerAccountId,
          query
        );
      let refreshQueued = false;
      let sendLatest: { send: () => void; close: () => void } | null = null;
      unsubscribe = subscribe("order.changed", (order) => {
        if (order.eventId !== targetEventId) return;
        if (sendLatest) {
          sendLatest.send();
          return;
        }
        refreshQueued = true;
      });

      const initial = await loadSnapshot();
      if (requestClosed) return;

      const sse = new SseConnection(res);
      sse.send("orders", initial);

      sendLatest = createQueuedSnapshotSender(
        loadSnapshot,
        (orders) => sse.send("orders", orders),
        "Event control center orders"
      );
      if (refreshQueued) {
        refreshQueued = false;
        sendLatest.send();
      }

      sse.onClose(() => {
        sendLatest?.close();
        unsubscribe?.();
      });
      res.off("close", handleEarlyClose);
    } catch (err) {
      res.off("close", handleEarlyClose);
      unsubscribe?.();
      if (requestClosed) return;
      handleError(err, res);
    }
  })
);

eventControlCenterRouter.use(eventControlCenterErrorHandler);
