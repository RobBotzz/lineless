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
2. **attendee** (Andi) — backend uses a localStorage-backed attendee session ID
   created via `POST /api/sessions/create` and sent as `X-Attendee-Session-ID`.
   No login screen.
3. **operator** (Oli) — backend uses a per-stand password. Operator enters the
   stand password to access a stand.

## Auth keychain concept

The backend intentionally has three different auth credentials, so the frontend
must not treat "the token" as one global value. Use a small auth keychain as the
single frontend source of truth for credentials and let every backend call
declare which credential it needs.

Backend auth facts to mirror:

- **Organizer:** JWT returned by `POST /api/account/login`, `POST
/api/account/signup`, and `PATCH /api/account/password`. It is sent as
  `Authorization: Bearer <token>` and carries `tokenType: "ORGANIZER"` plus
  `sub` as account id.
- **Operator:** JWT returned by `POST /api/operator/login`. It is sent as
  `Authorization: Bearer <token>` and carries `tokenType: "OPERATOR"` plus
  `standId`. It is scoped to exactly one stand.
- **Attendee:** session id returned by `POST /api/sessions/create`. It is sent
  as `X-Attendee-Session-ID: <sessionId>` and is scoped to exactly one event.
- **Public:** login, signup, attendee session creation, operator login, and
  other explicitly public calls send no auth credential.

Recommended keychain shape:

```ts
type AuthKey = 'public' | 'organizer' | 'operator' | 'attendee';

interface AuthKeychainSnapshot {
  organizer?: {
    token: string;
  };
  operator?: {
    token: string;
    standId: string;
  };
  attendee?: {
    sessionId: string;
    eventId: string;
    expiresAt: string;
  };
}
```

Store this under one versioned localStorage key, for example
`lineless.auth.keychain.v1`. Keep separate helper methods instead of exposing
raw localStorage access:

- `getCredential(kind)` returns the selected credential or `null`.
- `setOrganizerToken(token)` updates only the organizer entry.
- `setOperatorToken(token, standId)` updates only the operator entry.
- `setAttendeeSession(session)` updates only the attendee entry.
- `clearCredential(kind)` removes only that credential.

The API client uses an explicit auth mode. `auth` is required on every
`apiFetch` call, including public calls, so a protected endpoint can never
accidentally become unauthenticated because the caller omitted an option:

```ts
type ApiAuthMode = AuthKey;

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
}
```

Rules for attaching headers:

- `auth: 'public'`: attach no credential.
- `auth: 'organizer'`: attach only the organizer bearer token.
- `auth: 'operator'`: attach only the operator bearer token.
- `auth: 'attendee'`: attach only `X-Attendee-Session-ID`.
- Never attach more than one credential type to a single request.
- Do not support arrays like `auth: ['organizer', 'attendee']`; the route or
  API wrapper must choose one persona credential explicitly.
- The current foundation stores one active credential per role. Multi-operator
  or multi-event session switching is follow-up UI work, not part of the v1
  keychain shape.

Request modules should make the auth contract visible at the call site. Examples:

```ts
apiFetch('/account/info', { auth: 'organizer' });
apiFetch(`/events/${eventId}`, { auth: 'attendee' });
apiFetch(`/stands/${standId}`, { auth: 'operator' });
apiFetch('/operator/login', { method: 'POST', auth: 'public', body });
```

For endpoints that support multiple backend roles, the route decides the
credential:

- Organizer pages use organizer auth even for shared catalog endpoints.
- Attendee pages use attendee auth even when the same endpoint is organizer
  readable.
- Operator pages use operator auth for stand/product reads and product control
  actions.

401 handling must be credential-scoped. A failed organizer request should clear
only the organizer credential and redirect to organizer login. A failed operator
request should clear only the operator credential and return to stand login or
selection. A failed attendee request should clear only the attendee session and
create or request a new event session. Do not clear the whole keychain because a
single role credential expired.

Implementation order:

1. Use `src/auth/keychain.ts` as the only frontend credential store.
2. Change `apiFetch` to accept explicit `auth` modes and attach exactly one
   matching backend credential.
3. Update organizer auth provider and settings password flow to read/write the
   organizer entry.
4. Add operator login/session helpers that write the operator entry after
   `/operator/login`.
5. Add attendee session helpers that create, cache, expire, and send
   `X-Attendee-Session-ID`.
6. Update every API call to declare the intended auth mode.
7. Add focused tests or manual verification for header selection so organizer,
   operator, attendee, and public calls cannot leak the wrong credential.

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
- Backend calls from routes, loaders, actions, components, hooks, or auth code
  should go through named functions in `src/api/...`; `apiFetch` is the
  low-level HTTP/auth/error client used by those API modules.
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
