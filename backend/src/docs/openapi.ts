import { z } from "zod";
import type { Router } from "express";
import accountRouter from "../modules/accounts/routes";
import eventsRouter from "../modules/events/routes";
import { eventStandsRouter, standsRouter } from "../modules/stands/routes";
import {
  standProductsRouter,
  productsRouter,
} from "../modules/products/routes";
import ordersRouter from "../modules/orders/routes";
import sessionsRouter from "../modules/sessions/routes";
import {
  authOrganizer,
  authOrganizerOrAttendee,
  authOrganizerOrAttendeeOrEventLink,
  authOrganizerOrOperator,
  authOrganizerOrOperatorOrAttendee,
} from "../middleware/auth/guards";

// =============================================================================
// The OpenAPI document is GENERATED, not hand-written. We walk each mounted
// Express router's stack to discover every route's method + path, read the Zod
// body schema that `validateBody` attached to its handler, and detect auth by
// matching the auth middleware functions. Add a route anywhere below and it
// appears in /docs automatically — the only thing maintained by hand is the
// MOUNTS table (one line per mounted router).
// =============================================================================

const MOUNTS: { base: string; router: Router; tag: string }[] = [
  { base: "/api/account", router: accountRouter, tag: "Accounts" },
  { base: "/api/sessions", router: sessionsRouter, tag: "Sessions" },
  { base: "/api/events", router: eventsRouter, tag: "Events" },
  {
    base: "/api/events/:eventId/stands",
    router: eventStandsRouter,
    tag: "Stands",
  },
  { base: "/api/stands", router: standsRouter, tag: "Stands" },
  {
    base: "/api/stands/:standId/products",
    router: standProductsRouter,
    tag: "Products",
  },
  { base: "/api/products", router: productsRouter, tag: "Products" },
  { base: "/api/orders", router: ordersRouter, tag: "Orders" },
];

// Maps an auth middleware to the OpenAPI security requirement it enforces.
type SecurityRequirement = Record<string, string[]>;
const AUTH = new Map<unknown, SecurityRequirement[]>([
  [authOrganizer, [{ organizerAuth: [] }]],
  [
    authOrganizerOrAttendeeOrEventLink,
    [
      { organizerAuth: [] },
      { attendeeSessionAuth: [] },
      { operatorAccessKey: [] },
    ],
  ],
  [
    authOrganizerOrAttendee,
    [{ organizerAuth: [] }, { attendeeSessionAuth: [] }],
  ],
  [authOrganizerOrOperator, [{ organizerAuth: [] }, { standAuth: [] }]],
  [
    authOrganizerOrOperatorOrAttendee,
    [{ organizerAuth: [] }, { standAuth: [] }, { attendeeSessionAuth: [] }],
  ],
]);

// --- minimal shape of the Express router internals we read ---
type HandleFn = ((...args: unknown[]) => unknown) & { __zodBody?: z.ZodType };
interface Layer {
  name?: string;
  handle?: HandleFn;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: HandleFn }[];
  };
}

function stackOf(router: Router): Layer[] {
  return (router as unknown as { stack: Layer[] }).stack;
}

function securityFor(handle: unknown): SecurityRequirement[] | null {
  return AUTH.get(handle) ?? null;
}

// Converts a Zod schema into an OpenAPI-compatible JSON Schema. We use the
// "input" view so fields with defaults are optional for the client, and strip
// the top-level $schema key (not allowed inside OpenAPI). Dates are not
// representable in JSON Schema, so we render them as date-time strings.
function toSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
    override: (ctx) => {
      if (ctx.zodSchema._zod.def.type === "date") {
        ctx.jsonSchema.type = "string";
        ctx.jsonSchema.format = "date-time";
      }
    },
  }) as Record<string, unknown>;
  delete json["$schema"];
  return json;
}

// "/api/events" + "/:eventId/start" -> "/api/events/{eventId}/start"
function joinPath(base: string, rel: string): string {
  const raw = rel === "/" ? base : base + rel;
  return raw.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/+$/, "") || "/";
}

function pathParams(fullPath: string): Record<string, unknown>[] {
  const names = [...fullPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
  return names.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function responsesFor(
  hasAuth: boolean,
  hasBody: boolean
): Record<string, unknown> {
  const responses: Record<string, unknown> = {
    "2XX": { description: "Successful response" },
  };
  if (hasBody)
    responses["400"] = { description: "Request body failed validation" };
  if (hasAuth)
    responses["401"] = { description: "Missing or invalid authentication" };
  return responses;
}

interface Operation {
  fullPath: string;
  method: string;
  tag: string;
  security: SecurityRequirement[];
  bodySchema: z.ZodType | null;
}

// Walks one mounted router and returns one Operation per (route, method).
function collect(mount: (typeof MOUNTS)[number]): Operation[] {
  const ops: Operation[] = [];
  // Router-level auth applied via router.use(authX) before the routes.
  let routerSecurity: SecurityRequirement[] = [];

  for (const layer of stackOf(mount.router)) {
    if (!layer.route) {
      const sec = securityFor(layer.handle);
      if (sec) routerSecurity = sec;
      continue;
    }

    // Per-route auth + body schema live in the route's own handler stack.
    let routeSecurity: SecurityRequirement[] | null = null;
    let bodySchema: z.ZodType | null = null;
    for (const h of layer.route.stack) {
      const sec = securityFor(h.handle);
      if (sec) routeSecurity = sec;
      if (h.handle.__zodBody) bodySchema = h.handle.__zodBody;
    }

    const fullPath = joinPath(mount.base, layer.route.path);
    const security = routeSecurity ?? routerSecurity;
    for (const method of Object.keys(layer.route.methods)) {
      if (!layer.route.methods[method]) continue;
      ops.push({ fullPath, method, tag: mount.tag, security, bodySchema });
    }
  }
  return ops;
}

function buildPaths(): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const mount of MOUNTS) {
    for (const op of collect(mount)) {
      const item = (paths[op.fullPath] ??= {
        parameters: pathParams(op.fullPath),
      });
      item[op.method] = {
        tags: [op.tag],
        summary: `${op.method.toUpperCase()} ${op.fullPath}`,
        security: op.security,
        ...(op.bodySchema
          ? {
              requestBody: {
                required: true,
                content: {
                  "application/json": { schema: toSchema(op.bodySchema) },
                },
              },
            }
          : {}),
        responses: responsesFor(op.security.length > 0, op.bodySchema !== null),
      };
    }
  }
  return paths;
}

export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Lineless Backend API",
    version: "1.0.0",
    description:
      "Pay-per-use digital event queuing and ordering platform. This document " +
      "is generated automatically from the Express routes and Zod schemas.",
  },
  tags: [
    { name: "Accounts", description: "Organizer authentication and profile" },
    { name: "Sessions", description: "Attendee session lifecycle" },
    { name: "Events", description: "Event lifecycle (organizer only)" },
    {
      name: "Stands",
      description: "Stand management and operator authentication",
    },
    { name: "Products", description: "Products offered at a stand" },
  ],
  components: {
    securitySchemes: {
      organizerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Organizer JWT from POST /api/account/login or /signup",
      },
      attendeeSessionAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Attendee-Session-ID",
        description: "Attendee session ID from POST /api/sessions/create",
      },
      standAuth: {
        type: "http",
        scheme: "bearer",
        description: "Per-stand operator token",
      },
      operatorAccessKey: {
        type: "apiKey",
        in: "header",
        name: "X-Operator-Access-Key",
        description:
          "Secret event link key for operator onboarding (stand discovery)",
      },
    },
  },
  paths: buildPaths(),
};
