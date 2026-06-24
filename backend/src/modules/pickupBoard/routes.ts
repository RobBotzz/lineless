import { Router, type Request, type Response } from "express";
import { subscribe } from "../../lib/realtimeBus";
import { SseConnection } from "../../lib/sse";
import { authOperatorLink } from "../../middleware/auth/guards";
import { buildPickupBoard, standBelongsToPickupEvent } from "./service";

function eventId(req: Request): string {
  return req.params["eventId"] as string;
}

function handleError(err: unknown, res: Response): unknown {
  console.error("Pickup board error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

function createQueuedSnapshotSender<T>(
  loadSnapshot: () => Promise<T>,
  sendSnapshot: (snapshot: T) => void
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
      .catch((err) => console.error("Pickup board stream error:", err))
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

export const pickupBoardRouter = Router({ mergeParams: true });

// GET /events/:eventId/pickup-board — event-wide pickup monitor snapshot.
pickupBoardRouter.get(
  "/",
  authOperatorLink,
  async (req: Request, res: Response) => {
    try {
      const board = await buildPickupBoard(eventId(req));
      res.status(200).json(board);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// GET /events/:eventId/pickup-board/stream — live pickup monitor over SSE.
pickupBoardRouter.get(
  "/stream",
  authOperatorLink,
  async (req: Request, res: Response) => {
    const targetEventId = eventId(req);

    try {
      const loadSnapshot = () => buildPickupBoard(targetEventId);
      const initial = await loadSnapshot();

      const sse = new SseConnection(res);
      sse.send("pickup-board", initial);

      const sendLatest = createQueuedSnapshotSender(loadSnapshot, (board) =>
        sse.send("pickup-board", board)
      );
      const productStandIds = new Set(
        initial.stands.map((stand) => stand.standId)
      );
      const ignoredStandIds = new Set<string>();

      const unsubscribeOrders = subscribe("order.changed", (order) => {
        if (order.eventId !== targetEventId) return;
        sendLatest.send();
      });
      const unsubscribeProducts = subscribe("product.changed", (product) => {
        if (productStandIds.has(product.standId)) {
          sendLatest.send();
          return;
        }
        if (ignoredStandIds.has(product.standId)) return;

        void standBelongsToPickupEvent(targetEventId, product.standId)
          .then((belongsToEvent) => {
            if (!belongsToEvent) {
              ignoredStandIds.add(product.standId);
              return;
            }
            productStandIds.add(product.standId);
            sendLatest.send();
          })
          .catch((err) =>
            console.error("Pickup board product stream error:", err)
          );
      });
      const unsubscribeStands = subscribe("stand.changed", (stand) => {
        if (stand.eventId !== targetEventId) return;
        if (stand.standType === "PRODUCT" && stand.deletedAt === null) {
          productStandIds.add(stand._id);
          ignoredStandIds.delete(stand._id);
        } else {
          productStandIds.delete(stand._id);
          ignoredStandIds.add(stand._id);
        }
        sendLatest.send();
      });

      sse.onClose(() => {
        sendLatest.close();
        unsubscribeOrders();
        unsubscribeProducts();
        unsubscribeStands();
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);
