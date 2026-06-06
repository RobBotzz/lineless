# Lineless — Backend Project Context

This file is the briefing for anyone (human or AI tooling such as Claude Code)
working on the Lineless backend. It summarizes the architecture decisions made
so far, the data model, the conventions, and the explicit course constraints.
Read this before suggesting changes.

## What Lineless is

A pay-per-use digital event queuing and ordering platform for small-scale event
organizers (student councils, clubs, pop-up vendors). Event organizers configure
events, stands, and products; attendees order and pay (digital or cash) from their
phones; operators fulfill orders from a stand dashboard. The source-of-truth specs
are the data model and the two assignment / customer-journey documents kept in
`docs/`.

## Tech stack

- **Runtime:** Node.js + Express
- **Language:** TypeScript, `strict: true` (non-negotiable)
- **Database:** MongoDB (this is a course requirement — see Constraints below)
- **ODM:** Mongoose (provides the schema, enum, required-field, and default
  enforcement that MongoDB itself does not. Note: Prisma is NOT used — it is weak
  on MongoDB, and Mongoose is the better fit here.)
- **Realtime:** Server-Sent Events (SSE), NOT WebSockets. All the `/stream`
  endpoints in the docs are explicitly unidirectional server→client. MongoDB
  Change Streams pair naturally with SSE here.
- **Dev runner:** nodemon + ts-node (see Scripts)
- **Auth libraries:** bcrypt (password hashing), jsonwebtoken (JWT)

## Explicit course constraints (do not "fix" these)

1. **MongoDB is mandatory.** The data model is relational in shape, but we must
   use MongoDB. We adapt by modeling for access patterns (embed vs. reference)
   rather than copying the class diagram 1:1 into ~18 collections. Additional
   database variants can be added but the app core must be managed by MongoDB.
2. **No `.env` file.** Secrets live in a committed, typed config file
   (`src/config/config.ts`) so the project clones and runs with zero setup. This
   is a deliberate didactic trade-off for a university project. Do NOT introduce
   `.env` or `dotenv`. **Caveat:** never put real Stripe live keys or real
   production/payment data in the committed config — only the local DB URI and a
   demo JWT secret.

## Enums

Enums from the model: `ProductStatus` (LIVE/PAUSED/TERMINATED),
`TabStatus` (PENDING_AUTHORIZATION/OPEN/CHECKOUT_PENDING/PAID/FAILED),
`TabPaymentStatus` (PENDING/AUTHORIZED/CAPTURED/RELEASED/FAILED). Enforce via
Mongoose enum.

## Authentication — THREE separate identity types

This is the single most important thing to get right. There is no single auth
middleware; there are three, kept deliberately separate:

1. **Organizer (account, e.g. Emely)** — real login with `email` + `passwordHash`.
   Verify with bcrypt, issue a **JWT**, client sends it on subsequent requests.
   Middleware: `middleware/authOrganizer.ts`.
2. **Attendee (user, e.g. Andi)** — NO login. `POST /api/sessions/create`
   creates a record with an attendee session ID. The frontend stores it in
   localStorage and sends it as `X-Attendee-Session-ID` on subsequent requests.
   Middleware validates the header-backed session against MongoDB each request.
   Middleware: `middleware/authAttendee.ts`.
3. **Operator (stand, e.g. Oli)** — per-stand `accessPasswordHash`. Operator
   enters the stand password, compare with bcrypt, then issue a short-lived
   token scoped to that stand. Middleware: `middleware/authOperator.ts`.

Auth policy: password hashing is ALWAYS via bcrypt (never hand-rolled). The
logic around it (login route, token/session issuing, middleware) is
written ourselves — it's small and the three identity types don't fit any
generic boilerplate.

## Domain logic to be careful with

- **OrderItem state machine.** Items have `startedAt`, `readyAt`, `fulfilledAt`,
  `cancelledAt` — a timestamp-driven state machine, not a free-form field. The
  operator "tap → preparing → ready → cleared" flow must be validated
  server-side (no going backwards). Implement as an explicit transition
  function, not arbitrary PATCH.
- **Money is always an integer in cents.** Never float. (Model already does this:
  `priceExclTax`, `amountCents`, `authorizedCentsAmount`, etc.)
- **Stripe / Tab flow.** `POST /tabs` → Stripe session → authorize-then-capture.
  `TabPayment.authorizedCentsAmount` vs `capturedCentsAmount` is the standard
  authorize-on-order / capture-on-checkout pattern. Plan for Stripe **webhooks**;
  `stripeEventId` exists for idempotency (dedupe duplicate webhook events).
- **Multi-document transactions.** Flows that touch Order + Tab + TabPayment
  together need atomicity via `session.withTransaction(...)`. Requires MongoDB
  running as a replica set (even single-node) locally — common setup gotcha.
  Where we embed (Order + items), a single-document update is already atomic.

## Project structure (feature/domain-based, not layer-based)

```
lineless-backend/
├── src/
│   ├── modules/            # one folder per domain: routes + validation + service
│   │   ├── accounts/
│   │   ├── users/
│   │   ├── events/
│   │   ├── stands/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── tabs/
│   │   ├── payments/
│   │   └── ratings/
│   ├── middleware/
│   │   ├── authOrganizer.ts  # JWT (organizer)
│   │   ├── authAttendee.ts   # header session (attendee)
│   │   └── authOperator.ts   # stand JWT (operator)
│   ├── lib/
│   │   └── db.ts          # Mongoose connection
│   ├── config/
│   │   └── config.ts       # committed, typed config (NO .env)
│   ├── app.ts              # Express app (middleware, route mounting)
│   └── server.ts           # startup (DB connect, listen)
├── docs/                   # data model JSON + assignment/journey PDFs for reference
├── nodemon.json
├── tsconfig.json
└── package.json
```

Each module: Express Router → Zod (or equivalent) validation → service
(business logic + Mongoose). Keep logic in services, not route handlers.

### Layering: Router → Service → Mongoose (NO repository layer)

The fixed layering is **Router → Service → Mongoose model**. There is deliberately
**no separate repository/persistence layer** — a Mongoose model already _is_ the
data-access abstraction (validation, casting, defaults, query API), so wrapping it
in a pass-through repository would be empty boilerplate.

- **Router (controller):** thin. Lives in `*.routes.ts`. Reads `req`, calls the
  service, maps the result/error onto an HTTP status + JSON. Keep the controller as
  the route-handler callback unless a module grows many routes (only then split out
  a `*.controller.ts`).
- **Service:** all business logic + data access. Calls Mongoose models directly.
  MUST NOT touch `req`/`res` — it throws typed domain errors (e.g. `EmailTakenError`)
  and the router decides the status code.
- **Mongoose model:** schema + collection. Reusable query logic goes on the schema
  as a `static`/`method` or a small helper in the same module — NOT a repository class.

Only introduce a repository abstraction if MongoDB is ever swapped behind an
interface (it is course-mandated, so this won't happen).

## Containerization

The application consists of this repository (backend) and a second repository (frontend).
Each application must be dockerized (one Dockerfile each). In addition, this repository
also contains the docker-compose.yml file, which orchestrates the backend, frontend,
and database service. Although the compose file lies within this repository, ALWAYS
assume that it lies one folder higher, so it will reference the frontend build as ./frontend.

## Conventions

- Money: integer cents, never float.
- IDs: UUIDs (as in the data model).
- TypeScript `strict: true`.
- Config is committed (see Constraints) — do not propose `.env`/`dotenv`.
- Validate input at the route boundary before it reaches a service.
- Only use comments sparely and if you do, ONLY write in english.

## Scripts (package.json)

```json
"scripts": {
  "dev": "nodemon",
  "build": "tsc",
  "start": "node dist/server.js",
  "typecheck": "tsc --noEmit",
  "lint": "eslint src",
  "format": "prettier --write .",
  "prepare": "husky"
}
```

`nodemon.json`:

```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node src/server.ts"
}
```

Note: ts-node transpiles without full type-checking, so the dev server may run
even with a type error present. Full type-checking happens in the editor and on
`npm run build` (`tsc`). This is expected.

## Code quality & pre-commit hook

Quality is enforced automatically at commit time via a **Husky** pre-commit hook
(`.husky/pre-commit`). It runs, and aborts the commit on any failure:

1. **lint-staged** — on staged files only (fast): `eslint --fix` then
   `prettier --write` for `*.ts`; `prettier --write` for `*.{json,md,yml,yaml}`.
2. **`tsc --noEmit`** — full-project type check (types are cross-file, so this is
   not limited to staged files).

The hook is shared via git: the `"prepare": "husky"` script installs it on every
`npm install`, so no manual setup is needed — just run `npm install` after cloning.

Tooling and config:

- **Prettier** (`.prettierrc.json`) — formatting. Run manually with `npm run format`.
- **ESLint** (`eslint.config.mjs`) — flat config, type-checked rules
  (`typescript-eslint` `recommendedTypeChecked`) scoped to `src/**/*.ts`;
  `eslint-config-prettier` disables formatting-related rules. Run with `npm run lint`.
  The `@typescript-eslint/no-unsafe-*` rules are downgraded to **warnings** because
  the Express/JWT boundary is typed `any` — they nudge, but don't block.

Do NOT bypass the hook (`git commit --no-verify`) for normal work — fix the
reported issues instead.

## tsconfig essentials

`target: ES2022`, `module: CommonJS`, `rootDir: ./src`, `outDir: ./dist`,
`strict: true`, `esModuleInterop: true`, `resolveJsonModule: true`.
