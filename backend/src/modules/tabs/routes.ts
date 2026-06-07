import { Router, Request, Response } from "express";
import { createTab, checkoutTab } from "./service";
import { TabNotFoundError, TabStateError } from "./errors";

const tabsRouter = Router();

tabsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.organizer?.accountId ?? "test-user-id";
    const result = await createTab(userId);
    res.status(201).json(result);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

tabsRouter.post("/:tabId/checkout", async (req: Request, res: Response) => {
  try {
    const userId = req.organizer?.accountId || "test-user-id";
    const result = await checkoutTab(req.params["tabId"] as string, userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof TabNotFoundError)
      return res.status(404).json({ error: error.message });
    if (error instanceof TabStateError)
      return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default tabsRouter;
