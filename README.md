# Lineless

A pay-per-use digital event queuing and ordering platform for small-scale event
organizers — student councils, clubs, pop-up vendors. Organizers configure events,
stands and products; attendees browse, order and pay from their phones without ever
creating an account; operators fulfill orders from a live stand dashboard.

Built as a university project at TUM (SEBA Master, summer term 2026) by a team of
four over roughly three months.

## The three roles

Lineless has three distinct kinds of user, and the whole architecture follows from
keeping them separate:

| Role          | Identity                     | What they do                                              |
| ------------- | ---------------------------- | --------------------------------------------------------- |
| **Organizer** | Email + password → JWT       | Creates events, stands, products; sees analytics & payouts |
| **Attendee**  | Anonymous session id, no login | Browses stands, orders, pays by card or cash, rates products |
| **Operator**  | Per-stand password → scoped token | Works the stand dashboard: preparing → ready → handed out |

## Stack

**Backend** — Node.js · Express · TypeScript (`strict`) · MongoDB + Mongoose ·
Server-Sent Events for realtime · Stripe (authorize-on-order, capture-on-checkout) ·
bcrypt + JWT · Resend for transactional mail

**Frontend** — React 19 · TypeScript · Vite · React Router 7 · TanStack Query ·
Tailwind + shadcn/ui · Stripe Elements · ECharts · Leaflet

**Infrastructure** — Docker Compose orchestrating backend, frontend, MongoDB
(single-node replica set, for transactions and change streams) and the Stripe CLI
for webhook forwarding

## Layout

```
.
├── backend/            # Express API — see backend/README.md
├── frontend/           # React SPA — see frontend/README.md
└── docker-compose.yml  # runs the whole stack
```

The backend is organized into feature modules under `backend/src/modules/*`
(accounts, events, stands, products, orders, tabs, payments, payouts, ratings,
operator, pickupBoard, …), each following a Router → Service → Mongoose model
layering. `backend/CLAUDE.md` and `frontend/CLAUDE.md` document the architecture
decisions and conventions in detail.

## Running it

```bash
docker compose up --build
```

| Service            | URL                        |
| ------------------ | -------------------------- |
| Frontend           | http://localhost:3000      |
| Backend API        | http://localhost:8000      |
| API docs (Swagger) | http://localhost:8000/docs |

Then seed a fully populated demo event:

```bash
docker compose exec backend npm run db:seed
```

### You need to supply your own keys

This project was developed with its config committed on purpose (a deliberate
didactic trade-off — see `backend/CLAUDE.md`), so that it cloned and ran with zero
setup. Before publishing the code those credentials were revoked and stripped from
the entire git history, and replaced with self-describing placeholders:

| Placeholder                                              | Where                                      |
| -------------------------------------------------------- | ------------------------------------------ |
| `sk_test_REPLACE_WITH_YOUR_STRIPE_TEST_SECRET_KEY`        | `backend/src/config/config.ts`, `docker-compose.yml` |
| `whsec_REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET`           | `backend/src/config/config.ts`             |
| `pk_test_REPLACE_WITH_YOUR_STRIPE_TEST_PUBLISHABLE_KEY`   | `frontend/src/config.ts`                   |
| `re_REPLACE_WITH_YOUR_RESEND_API_KEY`                     | `backend/src/config/config.ts`, `docker-compose.yml` |
| `REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET`            | `backend/src/config/config.ts`, `docker-compose.yml` |

Drop in your own Stripe test keys and a Resend key (or set the corresponding
environment variables, which all take precedence) and the stack works end to end.
Everything except card payments and outbound email runs fine without them.

## A note on the history

Lineless was originally developed in two separate GitLab repositories, one per
application. This monorepo joins them: every commit from both repositories is
preserved with its original author, date and message, rewritten so that its files
live under `backend/` and `frontend/`. That means `git log`, `git log --follow` and
`git blame` work across the full history of either application.

What could not be carried over is everything that lived in GitLab's database rather
than in git — issues, merge request discussions, CI logs and labels. The merge
commits on `main` still trace which branch closed which issue.

## Team

Amelie Frenzel · Daniel Sich · Tim Michalow · Robin Böck
