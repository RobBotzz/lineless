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
- **Client data cache:** TanStack Query for operator-side component fetches that
  depend on keychain credentials.
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`), with shadcn-style
  primitives that we own in `src/components/ui/` (`button`, `card`,
  `text-field`, `password-text-field`, `toggle`). Class merging via `cn()` in
  `src/lib/utils.ts` (clsx + tailwind-merge); global styles in `src/index.css`.
  (History: the decision was deferred for a while; we landed on Tailwind + owned
  shadcn-style components over MUI to avoid dependency lock-in. Do not pull in a
  competing component library.)

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
- `loader` is attached directly to a `<Route>` for route-level one-shot fetches
  that do not depend on client-only keychain credentials (organizer pages and
  attendee public/product-selection reads). Read with `useLoaderData()`.
- TanStack Query is used for component-level Operator fetches that depend on the
  operator keychain credential (`operator-link` access key or per-stand operator
  token). Keep operator query keys centralized instead of rebuilding
  requestKey/status/cancelled state by hand in each screen.
- **SSE streams are NOT loaders.** Live data (`/orders/{id}/stream`,
  `/events/{id}/event-control-center/stream`, `/stands/{id}/orders/stream`) goes through a
  dedicated `useSSE` hook inside the component. Loaders = route one-shot
  fetches, TanStack Query = cached operator client fetches, streams = live
  updates. Keep this separation.

## Personas / Auth (mirrors the three backend auth types)

The `routes/` folder is split by persona — these are the three journeys and the
three backend auth worlds:

1. **organizer** (Emely) — backend uses JWT login. Organizer pages sit behind a
   JWT-based guard.
2. **attendee** (Andi) — backend uses a localStorage-backed attendee session ID
   created via `POST /api/sessions/create` and sent as `X-Attendee-Session-ID`.
   No login screen.
3. **operator** (Oli) — enters via a per-event operator link carrying an
   operator access key, then unlocks individual stands. The frontend credential
   holds the access key plus a map of stand id → stand token (see keychain
   below), so one operator can hold several stands at once.

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

The keychain is implemented in `src/auth/keychain.ts` and is the only module
that touches `localStorage`. Each credential lives under its own versioned key
(`lineless.auth.organizer.v1`, `lineless.auth.operator.v1`,
`lineless.auth.attendee.v1`) rather than a single combined blob. Per-credential
keys mean writing one persona's credential never rewrites another's, so
concurrent writers (e.g. two tabs) can't clobber each other and a corrupt entry
only drops itself — and the app never needs an atomic cross-credential snapshot.

Implemented credential shapes. Note operator and attendee are **collections**,
not single entries — multi-stand and multi-event are first-class:

```ts
interface OrganizerCredential {
  token: string;
}

interface OperatorCredential {
  eventId: string;
  operatorAccessKey: string;
  stands: Record<string, string>; // standId -> stand token
}

interface AttendeeCredential {
  sessions: Record<string, { sessionId: string; expiresAt: string }>; // eventId -> session
}
```

Access goes through typed helpers, never raw `localStorage`:

- `getCredential(kind)` / `hasCredential(kind)` — read any persona's credential.
- Organizer: `setOrganizer(token)`, `clearOrganizerCredential()`.
- Operator: `startOperatorSession(eventId, accessKey)`, `addOperatorStand(standId, token)`,
  `getOperatorStandToken(standId)`, `clearOperatorStand(standId)`, `clearOperatorCredential()`.
- Attendee: `getAttendeeSession(eventId)`, `setAttendeeSession(eventId, sessionId, expiresAt)`,
  `clearAttendeeSession(eventId)`, plus `subscribeAttendee(listener)` to react when a
  stored session changes (e.g. cleared by a 401) — used by `AttendeeRequireSession`.

The API client uses an explicit auth mode. `auth` is required on every
`apiFetch` call, including public calls, so a protected endpoint can never
accidentally become unauthenticated because the caller omitted an option:

```ts
type ApiAuthMode = 'public' | 'organizer' | 'operator' | 'operator-link' | 'attendee';

interface ApiFetchOptions extends RequestInit {
  auth: ApiAuthMode;
  // Scope ids the chosen mode needs to pick the right credential:
  eventId?: string; // required by 'attendee'
  standId?: string; // required by 'operator'
}
```

Rules for attaching headers (see `attachAuthHeader` in `src/api/client.ts`):

- `auth: 'public'`: attach no credential.
- `auth: 'organizer'`: `Authorization: Bearer <organizer token>`.
- `auth: 'operator'`: `Authorization: Bearer <stand token>` — requires a `standId`.
- `auth: 'operator-link'`: `X-Operator-Access-Key: <accessKey>` (link-entry flow,
  before any stand token exists).
- `auth: 'attendee'`: `X-Attendee-Session-ID: <sessionId>` — requires an `eventId`.
- Never attach more than one credential type to a single request.
- Do not support arrays like `auth: ['organizer', 'attendee']`; the route or
  API wrapper must choose one persona credential explicitly.
- The keychain already holds multiple stands (operator) and multiple event
  sessions (attendee) at once; what remains follow-up UI work is the switching
  surface for them, not the storage shape.

Request modules should make the auth contract visible at the call site. Examples:

```ts
apiFetch('/account/info', { auth: 'organizer' });
apiFetch(`/events/${eventId}`, { auth: 'attendee', eventId });
apiFetch(`/stands/${standId}`, { auth: 'operator', standId });
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

This is wired through a single callback: `apiFetch` calls `onUnauthorized(scope,
ids)` on a 401 (set via `setUnauthorizedHandler` in `src/api/client.ts`), and the
cross-cutting `src/auth/UnauthorizedHandler.tsx` component (mounted once at the
auth root) routes it to the right scope — organizer logout, or
`clearOperatorStand` / `clearOperatorCredential` / `clearAttendeeSession`. This
deliberately lives outside `OrganizerAuthProvider` because it spans every
persona, not just the organizer.

## Auth module layout

`src/auth/` is split by persona, mirroring the three credential worlds:

```
src/auth/
├── keychain.ts                 # the only localStorage owner (all personas)
├── UnauthorizedHandler.tsx     # cross-persona 401 router (mounted in App.tsx)
├── organizer/
│   ├── OrganizerAuthContext.ts   # context + useOrganizerAuth() hook + types
│   ├── OrganizerAuthProvider.tsx # holds organizer status/account, login/logout
│   └── OrganizerRequireAuth.tsx  # route guard for /organizer
└── attendee/
    ├── attendeeSession.ts        # ensure/validate the per-event session (lazy)
    └── AttendeeRequireSession.tsx# route guard that auto-creates the session
```

Naming rule: organizer auth symbols carry the persona prefix
(`OrganizerAuthContext`, `OrganizerAuthProvider`, `useOrganizerAuth`) so they
read unambiguously next to the other personas. The attendee side has no
context/provider on purpose — there is no shared, reactive attendee identity to
distribute; a route guard plus the keychain module is enough. Add a provider
only if attendee state ever needs to be read reactively across the tree.

## Project structure

The frontend's `src/` and config files live directly in the frontend folder (no
extra nested `lineless-frontend/` directory), symmetric to the backend.

```
src/
├── routes/                 # one area per persona; a page folder per route,
│   │                       #   each with its data.ts (loader/action) when needed
│   ├── organizer/          # /organizer/*
│   │   ├── OrganizerLayout.tsx
│   │   ├── dashboard/      # Dashboard.tsx + data.ts
│   │   ├── event-configuration/  # /organizer/events/:eventId
│   │   └── settings/
│   ├── attendee/           # /event/:eventId/* (URL noun is "event")
│   │   ├── AttendeeLayout.tsx
│   │   ├── product-selection/  # index route + data.ts
│   │   ├── cart/  ├── checkout/  └── order-history/
│   ├── operator/           # /operator/*
│   ├── auth/               # OrganizerAuth.tsx (the /auth login screen)
│   ├── Home.tsx
│   └── NotFound.tsx
├── auth/                   # credentials + guards, split by persona (see above)
├── api/                    # one module per backend resource; client.ts = apiFetch
├── components/             # ui/ (owned shadcn-style), layout/, feedback/,
│                           #   icons/ (shared SVG set), shared/, location/
├── features/               # cross-route feature modules (auth, branding, …)
├── hooks/                  # (planned) e.g. useSSE for the stream endpoints
├── lib/                    # utils.ts (cn helper)
├── types/                  # shared TS types mirroring the data model
├── paths.ts                # central URL builders, kept in sync with router.tsx
├── router.tsx              # central route definition
├── App.tsx                 # mounts providers + <RouterProvider>
└── main.tsx                # Vite entry point
```

Note the folder split is **by persona**, not by URL: file layout has no routing
role (routes are declared explicitly in `router.tsx`), so we organize by the
strongest axis — persona = auth world = layout. `paths.ts` is the bridge between
URLs and code.

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

## Coding guidelines

These are the working conventions for the frontend. They describe how the code
is already written — follow them so the codebase stays consistent.

### Language & types

- TypeScript strict. No `any`; prefer precise types and narrowing helpers (see
  the `isRecord`/`isString` parsers in `keychain.ts`). Use `unknown` at trust
  boundaries (parsing JSON / `localStorage`) and validate before use.
- Mirror backend contracts in `src/types/`; money is always integer **cents**,
  never a float.
- Prefer `type`/`interface` exports colocated with the module that owns them.

### Comments

- Keep them short, and **always in English** (even though we discuss in German).
- Prefer self-explanatory code; comment the **why**, not the what.

### Files, components & naming

- Components in `PascalCase.tsx`; one primary component per file. Hooks
  `useXxx`. Non-component modules in `camelCase.ts` (e.g. `attendeeSession.ts`,
  `keychain.ts`); the owned `components/ui/` primitives stay lowercase
  (`button.tsx`) to match their shadcn origin.
- Per-route folder with a colocated `data.ts` for that route's `loader`/`action`;
  export a route's error UI from the route module (e.g. `DashboardError`).
- When a name would be ambiguous across personas, prefix it with the persona
  (`OrganizerAuthProvider`, `useOrganizerAuth`, `AttendeeRequireSession`).
- Keep shared, reusable UI in `components/`; cross-route feature logic in
  `features/`; truly route-local pieces next to their route.

### Imports

- Use the `@/` alias for cross-area imports (`@/components/...`, `@/auth/...`);
  relative imports are fine within the same folder/feature.
- Import shared icons from `@/components/icons` — do not redeclare local icon
  sets per area.

### Routing & data fetching

- Route tree centralized in `router.tsx`; `App.tsx` only mounts providers and
  `<RouterProvider>`.
- `loader`/`action` for route-level one-shot reads/mutations that do not depend
  on client-only keychain credentials (read via `useLoaderData()`).
- TanStack Query for Operator component fetches that depend on keychain
  credentials and benefit from caching/refetching. Put reusable operator
  `queryKey` definitions next to the operator routes.
- `useSSE` hook for live streams. **Do not conflate** loaders, query-backed
  fetches, and streams.
- All backend access goes through named functions in `src/api/<resource>.ts`;
  `apiFetch` (in `api/client.ts`) is the low-level HTTP/auth/error client those
  modules call — components/routes never call `fetch` directly.

### Auth

- Every `apiFetch` call must declare an explicit `auth` mode; the route/API
  wrapper picks exactly one persona credential (never an array, never two).
- `keychain.ts` is the only module allowed to touch `localStorage`.
- 401 handling is credential-scoped via `UnauthorizedHandler` — never clear the
  whole keychain because one credential expired.

### Styling

- Tailwind utility classes; compose conditional classes with `cn()` from
  `lib/utils.ts`. Reuse the `components/ui/` primitives instead of re-styling raw
  elements. Do not add a competing component library.

### State

- Reach for React Context + Provider only for shared, reactive state that many
  components consume (as with the organizer auth). For a one-off gate or a value
  only read at call time, use a local hook/guard or a small module — see why the
  attendee side has no provider (Auth module layout above).

### Formatting & tooling

- Prettier + ESLint are authoritative; do not hand-fight their formatting. A
  Husky pre-commit hook runs `eslint --fix`, `prettier --write`, and `tsc -b`
  (typecheck) on staged files — commits must typecheck cleanly. Run `npm run
lint` / `npm run typecheck` locally before pushing.

## Scripts (package.json)

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc -b",
  "prepare": "husky"
}
```

`npm run dev` starts the Vite dev server with hot reload. A Husky pre-commit
hook runs lint-staged (`eslint --fix`, `prettier --write`) plus `tsc -b` on
staged files, so a commit that does not typecheck is rejected.

## Version caveat

React, Vite, and especially react-router move fast (react-router had notable
changes across v6 → v7). This context reflects a snapshot; when nailing down
router or build specifics, check the current react-router v7 docs, since the
recommended syntax can shift between minor versions.
