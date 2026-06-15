import { Router, type Request, type Response } from "express";
import { authOperator } from "../../middleware/auth/guards";
import { subscribe } from "../../lib/realtimeBus";
import { SseConnection } from "../../lib/sse";
import { buildOperatorBoard, getStandProductIds } from "./board";

// =============================================================================
// Operator dashboard routes — mounted at /api/operator
// =============================================================================
export const operatorRouter = Router();

// GET /operator/board — current board snapshot for the authenticated stand.
operatorRouter.get(
  "/board",
  authOperator,
  async (req: Request, res: Response) => {
    try {
      const board = await buildOperatorBoard(req.operator!.standId);
      res.status(200).json(board);
    } catch (err) {
      console.error("Operator board error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /operator/board/stream — same board, pushed live over SSE on every change.
operatorRouter.get(
  "/board/stream",
  authOperator,
  async (req: Request, res: Response) => {
    const standId = req.operator!.standId;
    try {
      // Resolve everything that can fail BEFORE the SSE headers go out, so an
      // error still maps to a clean 500 instead of a half-open stream.
      const standProductIds = await getStandProductIds(standId);
      const initial = await buildOperatorBoard(standId);

      const sse = new SseConnection(res);
      sse.send("board", initial);

      const unsubscribe = subscribe("order.changed", (order) => {
        const affectsStand = order.items.some((i) =>
          standProductIds.has(i.productId)
        );
        if (!affectsStand) return;
        buildOperatorBoard(standId)
          .then((board) => sse.send("board", board))
          .catch((err) => console.error("Operator board stream error:", err));
      });

      const unsubProduct = subscribe("product.changed", (product) => {
        if (product.standId !== standId) return;
        buildOperatorBoard(standId)
          .then((board) => sse.send("board", board))
          .catch((err) => console.error("Operator board stream error:", err));
      });

      sse.onClose(() => {
        unsubscribe();
        unsubProduct();
      });
    } catch (err) {
      console.error("Operator board stream error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
