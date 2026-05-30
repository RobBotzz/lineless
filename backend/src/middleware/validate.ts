import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";

// Wraps a route handler with body validation. The handler receives the parsed,
// fully typed data as its third argument — no req.body access or casts needed.
export function validateBody<S extends z.ZodType>(
  schema: S,
  handler: (
    req: Request,
    res: Response,
    data: z.infer<S>
  ) => unknown | Promise<unknown>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Validation failed", details: result.error.issues });
      return;
    }
    try {
      await handler(req, res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
