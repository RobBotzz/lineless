# Lineless — Frontend

The Lineless single-page app: a React SPA that talks to the [backend](../backend)
over a REST API plus several Server-Sent-Event streams. One codebase serves three
very different users — the organizer configuring an event, the attendee ordering
from their phone, and the operator working a stand.

**Stack:** React 19 · TypeScript (strict) · Vite · React Router 7 (Data Router) ·
TanStack Query · Tailwind CSS v4 with owned shadcn-style primitives ·
Stripe Elements · ECharts · Leaflet

## The three personas

`src/routes/` is split by persona, because each one has a different journey _and_
a different backend auth mechanism:

| Persona       | How they get in                                      | Their screens                                                  |
| ------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| **Organizer** | Email + password → JWT, behind a route guard         | Dashboard, event configuration, event control center, settings |
| **Attendee**  | No login — an anonymous session id in `localStorage` | Product selection, cart, checkout, order tracking, ratings     |
| **Operator**  | Per-event operator link, then per-stand password     | Stand selection, stand dashboard, pickup dashboard, cashier    |

## Two decisions worth knowing about

### The auth keychain

Three personas means there is no such thing as "the token". A single global auth
context would be wrong: an operator can hold several stands at once (an access key
_plus_ a map of stand id → stand token), and an expired attendee session must not
log an organizer out.

So `src/auth/keychain.ts` is the **only** module in the app allowed to touch
`localStorage`. It stores credentials per persona and, for operators, per stand.
Everything else — route guards, loaders, query hooks — reads through it. When one
credential expires, only that credential is dropped.

### Loaders vs. Query vs. SSE

Three ways to read data, picked by **access pattern**, not by which credential is
involved:

| Mechanism             | Used for                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Router `loader` | Route-entry, one-shot, URL-driven reads (organizer pages, attendee entry pages)                                                                      |
| TanStack Query        | In-component reads that must cache, refetch, or react to client state — chiefly operator screens whose fetches are gated on the multi-stand keychain |
| `useSSE` hook         | Live server-pushed updates (order tracking, stand order stream, event control center)                                                                |

The same endpoint legitimately appears in more than one world — the page's access
pattern decides. SSE streams are deliberately never loaders: a loader is one-shot
and cannot coordinate with a stream.

## Project structure

```
src/
├── routes/       # page views, one folder per persona journey
├── features/     # domain logic: auth, branding, cart, catalog, orders, payment
├── components/
│   ├── ui/       # owned shadcn-style primitives — do not hand-edit
│   ├── shared/   # our wrappers (PrimaryButton, QuantityStepper, StarRating, …)
│   ├── layout/   # navbar, layout containers
│   ├── feedback/ # alert and stock-conflict dialogs
│   └── location/ # Leaflet location picker and static map
├── api/          # one module per backend domain, all through client.ts
├── auth/         # keychain.ts, token refresh, unauthorized handling
├── hooks/        # useSSE, useEscapeKey
├── lib/          # queryClient, storage, IBAN and order helpers, cn()
├── router.tsx    # the <Route> tree (structural source of truth)
└── paths.ts      # typed absolute URLs for consumers of the route tree
```

`CLAUDE.md` documents the architecture decisions, conventions and their reasoning
in full.

## Local development

Easiest path is to run the whole stack with Docker from the repository root (see
the [root README](../README.md)). To iterate on the UI itself, start the backend
(and MongoDB) separately and then:

```bash
npm install      # also installs the git pre-commit hook
npm run dev      # http://localhost:3000
```

The Vite dev server proxies `/api/*` to the backend on port 8000, so there is no
CORS setup in development. `npm run dev:host` binds it to the local network
instead of localhost, so the attendee flow can be opened on a phone.

Scripts: `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` ·
`npm run format` · `npm run preview`

Card payments need a Stripe publishable test key in `src/config.ts`, which ships
as a placeholder — see [the note in the root README](../README.md#you-need-to-supply-your-own-keys).

## Code quality

A Husky pre-commit hook runs `eslint --fix` and `prettier --write` on staged files
and then type-checks the whole project with `tsc -b`. It installs itself on
`npm install`.
