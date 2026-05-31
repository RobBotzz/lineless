import type { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";

// A request handler that carries the Zod body schema it validates against, so
// the OpenAPI generator can discover request bodies by walking the route stack.
export interface BodyValidatedHandler extends RequestHandler {
  __zodBody?: z.ZodType;
}

// Wraps a route handler with body validation. The handler receives the parsed,
// fully typed data as its third argument — no req.body access or casts needed.
export function validateBody<S extends z.ZodType>(
  schema: S,
  handler: (req: Request, res: Response, data: z.infer<S>) => unknown
): BodyValidatedHandler {
  const mw: BodyValidatedHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: result.error.issues });
      return;
    }
    try {
      await handler(req, res, result.data);
    } catch (err) {
      next(err);
    }
  };
  mw.__zodBody = schema;
  return mw;
}
