# AGENTS.md — OptiqSports Basketball Frontend

This file is read automatically at the start of every session. Follow everything here before writing a single line of code.

---

## Two Repos, One Product

| Repo | Path | Role |
|------|------|------|
| Frontend | `/Users/user/Documents/GitHub/optiqSports/basketball-fe` | React 19 + Vite + Tailwind |
| Backend | `/Users/user/Documents/GitHub/optiqSports/basketball-be` | NestJS + Prisma + Redis |

Both repos must be open and understood before touching either one.

---

## Rule #1 — Always Read the Backend First

Before implementing or wiring any frontend feature:

1. Read the backend **controller** for that feature to understand the exact route, method, and auth guard
2. Read the backend **service** to understand what the response shape actually is
3. Read the backend **DTO** to know exactly what fields are accepted or returned
4. Only then touch the frontend

Do not assume the response shape from the frontend types alone — the backend is the source of truth. The types in `src/types/api.ts` may be incomplete or stale.

Backend source files live at:
```
basketball-be/src/
├── auth/
├── admin/
├── players/
├── teams/
├── tournaments/
├── matches/
├── statistician/
├── statdash/
│   ├── sessions/
│   ├── events/
│   ├── projections/
│   └── realtime/
├── common/
│   └── queue/
└── upload/
```

---

## Architecture: Two Separate UX Shells

The app has two completely separate UI trees that share the same codebase. The fork happens in `AppGate` based on the `role` field from `GET /auth/profile`.

### Admin Shell
- Roles: `ADMIN`, `SUPER_ADMIN`
- Layout: sidebar + navbar via `Wrapper`
- Routes: `/dashboard`, `/tournaments`, `/teams-management`, `/players-management`, `/statisticians`, `/users`, `/start-new`

### Statistician Shell
- Role: `STATISTICIAN`
- Layout: isolated fullscreen via `StatisticianLayout` — no sidebar, no navbar
- Routes: `/match-key` → `/starters` → `/choose-sides` → `/jump-ball` → `/stat-dash`
- **State is passed between these pages via `sessionStorage`, not URL params or React state**
- Keys are defined in `src/features/statdash/sessionContextStorage.ts`
- If `sessionStorage` is cleared mid-flow, the statistician loses their game session — be careful here

---

## API Client Pattern

All REST calls go through the central client. Never use raw `fetch` in a page component.

```
src/api/ApiClient.ts   — the ApiClient class with all endpoint methods
src/api/hooks.ts       — React Query useQuery / useMutation wrappers (use these in components)
```

When adding a new endpoint:
1. Add the method to the correct namespace in `ApiClient.ts`
2. Add the React Query hook in `hooks.ts`
3. Use the hook in the component — never call `apiClient` directly from a page

StatDash has its own separate service layer:
```
src/services/statdash/
├── sessions.api.ts       — session bootstrap, resolve match key
├── commands.api.ts       — game event commands
├── projections.api.ts    — box score, shot chart, summary, rebuild
├── realtime.client.ts    — SSE stream
└── hooks.ts              — React Query hooks for statdash
```

---

## State Management — Where Things Live

| What | Where |
|------|-------|
| Server data (API responses) | TanStack React Query v5 — `src/api/hooks.ts` |
| Auth token | `localStorage.access_token` |
| Current user profile | `useProfile()` hook — re-fetched on every mount (`staleTime: 0`) — intentional |
| Statistician game context | `sessionStorage` — sessionId, matchId, teamIds, version, orientation, team colors |
| Game event queue | `src/features/statdash/eventQueue/` — offline-capable, retries on failure |
| Local UI state | `useState` per page — modals, filters, forms |

---

## The Event Queue — Do Not Bypass

The statdash event queue (`src/features/statdash/eventQueue/`) queues game commands locally and retries on failure. Commands carry:
- **Idempotency keys** — so retried commands are not double-applied
- **`expectedVersion`** — optimistic concurrency; the backend rejects stale writes with a version conflict

Never send game commands with raw `fetch` outside this queue. If the queue is broken, fix the queue — do not go around it.

---

## Key Gotchas

**No auth guard on `/upload`.** Anyone can upload files to Cloudinary without a token. Do not add more unguarded upload paths.

**No refresh token flow end-to-end.** The backend issues refresh tokens and stores them in the DB, but `/auth/refresh` does not exist. When the JWT expires, the user is redirected to `/login`. Do not build features that depend on long-lived sessions until this is resolved.

**`staleTime: 0` on profile is intentional.** The profile re-fetches on every mount to catch expired tokens and enforce role-based routing. Do not add a staleTime to `useProfile`.

**`STATISTICIAN` role has backend permissions to create/update teams, players, and tournaments.** The frontend only shows those screens to `ADMIN`/`SUPER_ADMIN`. This is intentional — do not expose admin routes to statisticians.

**The StartNew wizard sub-routes are currently orphaned.** `/teams`, `/players`, `/team-overview`, and `/complete` exist as standalone routes but `StartNew.tsx` does not navigate through them sequentially. See `API_WIRING_PROGRESS.md` item 6.

---

## Active Work Tracking

`API_WIRING_PROGRESS.md` — the single source of truth for what is hardcoded, what is being wired, and what is done. Check it at the start of every session and update it as work completes.

`TASKS_IMPLEMENTATION_STATUS.md` — tracks UI/product bugs separately. Do not mix with API wiring work.

`CODEBASE_REVIEW.md` — full architectural review of the frontend against the backend. Read it for context on any unfamiliar area before diving in.

---

## Before Ending Any Session

- Update `API_WIRING_PROGRESS.md` — change `⏳` to `✓` for anything completed, update the summary table counts
- If a backend response shape differed from what the frontend types said, update `src/types/api.ts`
