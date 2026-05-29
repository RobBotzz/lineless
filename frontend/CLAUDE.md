# Lineless — Frontend Project Context

This file is the briefing for anyone (human or AI tooling such as Claude Code)
working on the Lineless frontend. It summarizes the setup, structure, and
conventions decided so far. Read this before suggesting changes. The backend has
its own CLAUDE.md; this one covers the frontend only.

## What Lineless is

A pay-per-use digital event queuing and ordering platform for small-scale event
organizers. The frontend is a **SPA** that talks to a separate Express + MongoDB
backend over a REST API plus several Server-Sent-Event (SSE) streams. There are
three distinct user personas, each with its own area and its own backend auth
mechanism (see Personas / Auth below). Source-of-truth specs (data model,
customer journeys) live in the backend repo's `docs/`.

## Tech stack

- **Framework:** React 19
- **Language:** TypeScript (strict)
- **Build tool:** Vite (chosen over Next.js — we want a plain SPA against a
  separate backend, no SSR, and our own routing)
- **Routing:** react-router v7
- **Styling:** NOT YET DECIDED. Deliberately deferred.
  Tailwind / MUI / Shadcn can all be added later without rework. Notes:
  - Tailwind = utility CSS, no components; trivial to add later.
  - MUI = ready-made component library (npm dependency); fastest path to a
    polished dashboard/form/table UI; higher lock-in but incremental.
  - Shadcn = you copy component source into the repo and own it; builds ON TOP
    OF Tailwind, so choosing Shadcn implies adding Tailwind first.
  - The only indirect fork is Tailwind yes/no (because Shadcn needs it), and even
    that is retrofittable. Do not block on this.

## Routing — the chosen approach (Variant C)

We use **`createBrowserRouter` + `createRoutesFromElements`**: JSX route syntax
(readable, tree-like) wrapped into a Data Router (so `loader`/`action` are
available when we want them). This is the best of both worlds for v7.

Key facts:

- The real fork in react-router is `<BrowserRouter>`/`<Routes>` (old mode, NO
  loaders) vs. `createBrowserRouter` (Data Router, loaders available). We chose
  the Data Router. Within it, object-array vs. `createRoutesFromElements` JSX is
  pure style — we picked JSX for readability.
- Router definition lives in its own `src/router.tsx`; `App.tsx` only renders
  `<RouterProvider router={router} />`.
- `loader` is attached directly to a `<Route>` for one-shot fetches (event
  config, lists). Read with `useLoaderData()`.
- **SSE streams are NOT loaders.** Live data (`/orders/{id}/stream`,
  `/events/{id}/analytics/stream`, `/stands/{id}/orders/stream`) goes through a
  dedicated `useSSE` hook inside the component. Loaders = one-shot fetches,
  streams = live updates. Keep this separation.

## Personas / Auth (mirrors the three backend auth types)

The `routes/` folder is split by persona — these are the three journeys and the
three backend auth worlds:

1. **organizer** (Emely) — backend uses JWT login. Organizer pages sit behind a
   JWT-based guard.
2. **attendee** (Andi) — backend uses an httpOnly session cookie created via
   `POST /users/session`. No login screen.
3. **operator** (Oli) — backend uses a per-stand password. Operator enters the
   stand password to access a stand.

## Project structure

The frontend's `src/` and config files live directly in the frontend folder (no
extra nested `lineless-frontend/` directory), symmetric to the backend.

```
src/
├── routes/                 # one area per persona
│   ├── organizer/
│   │   ├── OrganizerLayout.tsx
│   │   ├── Dashboard.tsx
│   │   └── EventConfig.tsx     # uses useParams() for :eventId
│   ├── attendee/
│   │   ├── AttendeeLayout.tsx
│   │   └── ProductSelection.tsx
│   ├── operator/
│   │   ├── OperatorLayout.tsx
│   │   └── StandSelection.tsx
│   ├── Home.tsx
│   └── NotFound.tsx
├── components/             # reusable UI pieces
├── api/                    # fetch wrappers, one module per backend resource
├── hooks/                  # e.g. useSSE for the stream endpoints
├── types/                  # shared TS types mirroring the data model
├── router.tsx              # central route definition
├── App.tsx                 # App
└── main.tsx                # Vite entry point
```

## Dev proxy (CORS)

Frontend runs on Vite's port (5173), backend on 3000. To avoid CORS hassle in
dev, Vite proxies API calls. In `vite.config.ts`:

```ts
server: {
  proxy: { "/api": "http://localhost:3000" }
}
```

Call `/api/...` from the frontend; Vite forwards to the backend. Assumes backend
routes are mounted under `/api` (or adjust the path).

## Shared types

The data model already exists. Mirror the TS interfaces for `Order`, `Product`,
`Event`, etc. in `src/types/`, ideally matching the backend's Mongoose schemas.
For a university project, keeping them in sync by hand is fine and forces us to
think about the API contracts. Money is always integer cents (matches backend).

## Conventions

- TypeScript strict.
- **Comments: keep them short, and always write them in English only** (no German
  comments, even though we discuss in German). Prefer self-explanatory code over
  comments; comment the "why", not the "what".
- Routing definition centralized in `router.tsx`; `App.tsx` stays minimal.
- Loaders for one-shot fetches; `useSSE` hook for live streams — do not conflate.
- routes/ split by persona (organizer / attendee / operator).
- Styling decision is deferred; start with plain CSS, do not prematurely commit
  to Tailwind/MUI/Shadcn.
- Money: integer cents, never float.

## Scripts (package.json — Vite defaults)

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```

`npm run dev` starts the Vite dev server with hot reload.

## Version caveat

React, Vite, and especially react-router move fast (react-router had notable
changes across v6 → v7). This context reflects a snapshot; when nailing down
router or build specifics, check the current react-router v7 docs, since the
recommended syntax can shift between minor versions.
