# Lineless — Backend

Pay-per-use digital event queuing & ordering platform for small events.
Organizers configure events, stands and products; attendees order and pay from
their phones; operators fulfill orders from a stand dashboard.

**Stack:** Node.js + Express · TypeScript (strict) · MongoDB + Mongoose · SSE for
realtime · Stripe (authorize-then-capture) · bcrypt + JWT auth.

## Getting started (Docker)

The whole stack (backend, frontend, MongoDB, Stripe webhook forwarding) runs
with Docker Compose. Config is **committed** — no `.env` or Stripe login needed.

1. Put the **backend** and **frontend** repos side by side in one parent folder,
   each in its own subfolder named `Backend` and `Frontend`:

   ```
   my-lineless/
   ├── Backend/
   ├── Frontend/
   └── docker-compose.yml   ← step 2
   ```

2. Copy `Backend/docker-compose.yml` up into that parent folder (it references
   `./Backend` and `./Frontend` as build contexts).

3. From the parent folder, build and start everything:

   ```bash
   docker compose up --build
   ```

Once it is up:

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:3000      |
| Backend API        | http://localhost:8000      |
| API docs (Swagger) | http://localhost:8000/docs |
| mongo-express      | http://localhost:8081      |

Card payments work out of the box — the bundled `stripe-cli` service forwards
Stripe webhooks to the backend automatically.

## Demo data (seeding)

Populates a ready-to-demo event ("MPIC Sommerfest") with stands, products,
orders in every state, ratings, cash refunds and card/tab payments.

With the stack running, seed from the backend container:

```bash
docker compose exec backend npm run db:seed
```

The seed is **idempotent**: it purges the demo event/account and rebuilds it, so
just re-run it if anything gets into a bad state. Product/logo images live in
`Backend/seed-assets/` (see `seed-assets/README.md`); they are baked into the
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

## Local backend development (without Docker)

```bash
npm install         # also installs the git pre-commit hook
npm run db:up       # start just MongoDB (single-node replica set) via Docker
npm run dev         # API on http://localhost:8000 (ts-node + nodemon)
npm run db:seed     # seed against the local DB
```

Common scripts: `npm run dev` · `npm run build` · `npm run typecheck` ·
`npm run lint` · `npm run db:up` / `db:down` · `npm run db:seed`.

## Project layout

Feature-based modules under `src/modules/*` (each: routes → service → Mongoose
model). See `CLAUDE.md` for architecture, conventions and course constraints.
