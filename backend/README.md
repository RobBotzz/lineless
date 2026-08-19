# Lineless — Backend

Pay-per-use digital event queuing & ordering platform for small events.
Organizers configure events, stands and products; attendees order and pay from
their phones; operators fulfill orders from a stand dashboard.

**Stack:** Node.js + Express · TypeScript (strict) · MongoDB + Mongoose · SSE for
realtime · Stripe (authorize-then-capture) · bcrypt + JWT auth.

## Getting started (Docker)

The whole stack (backend, frontend, MongoDB, Stripe webhook forwarding) runs with
Docker Compose from the repository root:

```bash
docker compose up --build
```

Once it is up:

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:3000      |
| Backend API        | http://localhost:8000      |
| API docs (Swagger) | http://localhost:8000/docs |

Card payments need your own Stripe test keys — see
[the note on placeholders](../README.md#you-need-to-supply-your-own-keys) in the
root README. With them in place the bundled `stripe-cli` service forwards Stripe
webhooks to the backend automatically, so authorize-then-capture works end to end.

## Demo data (seeding)

Populates a ready-to-demo event ("MPIC Sommerfest") with stands, products,
orders in every state, ratings, cash refunds and card/tab payments.

With the stack running, seed from the backend container:

```bash
docker compose exec backend npm run db:seed
```

The seed is **idempotent**: it purges the demo event/account and rebuilds it, so
just re-run it if anything gets into a bad state. Product/logo images live in
`backend/seed-assets/` (see `seed-assets/README.md`); they are baked into the
image at build time, so `docker compose up --build` after changing them. The full
list of ids and credentials is printed at the end of each run.

### Login data

**Organizer** (email + password login):

| Email                     | Password          |
| ------------------------- | ----------------- |
| `orga@mpic-fachschaft.de` | `Sommerfest2026!` |

**Operator / cashier** (open a stand via the operator link — the event access
key, plus a stand password where set):

- Operator access key: `4f61300d-e20d-5ab5-a56d-ca054f2f3860`
- **Cash Desk** stand — password `cashier2026`
- Product stands (Grill & BBQ, Drinks & Bar, Sweets & Coffee) — no password

**Attendees** need no login — the frontend creates an anonymous session
automatically.

## Emails (Resend)

Transactional emails (password reset, welcome, order-created & order-confirmed)
are sent through **[Resend](https://resend.com)**, an email-delivery API. Flow:
React Email templates in `src/lib/email/templates/*` are rendered to HTML in
`mailer.tsx` and handed to the Resend client (`client.ts`), which delivers them
via the Resend API using the key + sender in `config.resend`. Order emails are
fire-and-forget — a delivery failure is only logged and never blocks the order.

Templates can be rendered to static HTML without sending anything:

```bash
npm run email:preview
```

Two deliberate, pragmatic limitations for this project:

- **Product images in emails only render on a deployed instance, not over
  localhost.** Images are embedded as absolute URLs built from `appBaseUrl`; the
  recipient's mail client fetches them from that public URL, and a `localhost`
  address isn't reachable from their device — so images stay blank in local dev
  and load only on a public (deployed) domain.
- **Order-email links only work on the device that placed the order.** For
  simplicity, attendees have no login — their identity is a session id stored in
  that browser's `localStorage`, and the order is bound to it. So the "track /
  pay" link in an order email only opens the order in the **same browser/device**
  that ordered (the one holding the sessionId); opening it elsewhere or in
  incognito won't load it.

## Local backend development (without Docker)

```bash
npm install         # also installs the git pre-commit hook
npm run db:up       # start just MongoDB (single-node replica set) via Docker
npm run dev         # API on http://localhost:8000 (ts-node + nodemon)
npm run db:seed     # seed against the local DB
```

Common scripts: `npm run dev` · `npm run build` · `npm run typecheck` ·
`npm run lint` · `npm run db:up` / `db:down` · `npm run db:seed`.

## Architecture

### Layering: Router → Service → Mongoose model

There is deliberately **no repository layer**. A Mongoose model already is the
data-access abstraction — validation, casting, defaults, query API — so wrapping it
in a pass-through repository would be empty boilerplate.

- **Router** (`routes.ts`) stays thin: read `req`, call the service, map the result
  or a typed domain error onto an HTTP status.
- **Service** (`service.ts`) holds all business logic and data access. It never
  touches `req`/`res`; it throws typed errors and lets the router pick the status.
- **Model** (`model.ts`) is schema and collection. Reusable query logic goes on the
  schema as a static or method.

Modules are feature-based, not layer-based. A module grows the files it actually
needs — `orders/`, for instance, is `routes` · `service` · `model` · `types` ·
`errors` plus `inventory`, `tabAuthorization`, `emailNotifications` and
`changeStream`.

### Three separate identity types

The single most important design constraint. There is no one auth middleware, but
three, kept deliberately apart in `src/middleware/auth/`:

| Identity      | Credential                                               | Verified by                           |
| ------------- | -------------------------------------------------------- | ------------------------------------- |
| **Organizer** | `email` + `passwordHash` → JWT                           | `organizer.ts`                        |
| **Attendee**  | Session id in `X-Attendee-Session-ID`, no login          | `attendee.ts`                         |
| **Operator**  | Event access key, then per-stand password → scoped token | `operator.ts`, `operatorAccessKey.ts` |

`ACCESS_MATRIX.md` in that folder documents which identity may reach which route.
Password hashing is always bcrypt; the logic around it is written by hand, because
the three identity types fit no generic boilerplate.

### Realtime

Live updates are **Server-Sent Events**, not WebSockets — every stream in the spec
is unidirectional server→client.

Between the database and the client sits an in-process publish/subscribe bus
(`lib/realtimeBus.ts`). MongoDB **change streams** for orders, products, ratings,
stands and event-control-center settings are started at boot in `server.ts` and
publish domain events onto it; SSE endpoints (`lib/sse.ts`) subscribe and fan them
out to connected clients. Each watcher reconnects on its own with exponential
backoff.

Because the bus does not know either side, a mutation persisted by any path — an
API call, the seed script, a manual edit in the database — reaches subscribers the
same way. The trade-off is that the bus is in-process: several backend instances
would need a shared transport behind the same `publish()`/`subscribe()` API.

### Domain rules worth calling out

- **Money is always an integer in cents**, never a float: `amountCents`,
  `authorizedCentsAmount`, `capturedCentsAmount`, `processingFeeCents`.
- **Order items are a timestamp-driven state machine.** `startedAt`, `readyAt`,
  `fulfilledAt` and `cancelledAt` drive the operator's tap → preparing → ready →
  cleared flow, validated server-side through an explicit transition function so
  state cannot move backwards.
- **Payments follow authorize-then-capture.** A tab authorizes a hold when the
  order is placed and captures at checkout. Stripe webhooks are deduplicated via
  `stripeEventId`, so a redelivered event is a no-op.
- **Multi-document flows are transactional.** Anything touching Order, Tab and
  TabPayment together runs inside `session.withTransaction(...)`, which is why
  MongoDB runs as a single-node replica set even locally.

`CLAUDE.md` documents the conventions and the course constraints behind them in
full; `ENDPOINTS.md` lists the API surface.

## Testing

```bash
npm run test:policy   # event mutation policy unit tests
```

`tests/bruno/` holds [Bruno](https://www.usebruno.com) collections for exercising
the API by hand, including the payment flows.
