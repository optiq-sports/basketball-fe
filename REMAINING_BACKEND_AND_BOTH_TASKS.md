# Remaining Backend and Both Tasks

All tasks that require **Backend** work and/or **Both** (Backend + Frontend) work — yet to be done. Frontend-only items are not listed here.

---

## Backend-only tasks

| # | Area | Task | Notes |
|---|------|------|--------|
| 1 | Tournament | **Uploaded tournament flyer not displaying** | Accept/store flyer (URL or file) and return it in tournament payload (`flyer` in api). Frontend already has placeholder; show `tournament.flyer` when present. |
| 2 | Tournament | **Division – duplicate prevention** | Idempotency or duplicate check so multiple rapid creates do not create duplicate competitions (works with frontend validation). |
| 3 | Tournament | **Match status correctness** | Ensure match `status` is correct (SCHEDULED vs LIVE) and listing/query filters or sorts by status correctly. |
| 4 | Tournament | **Statistician list for Assign Statistician** | Expose list of statisticians (or ensure existing statistician API is used) for assignee dropdown. |
| 5 | Tournament | **Schedule time storage** | Store and return times in a single timezone (e.g. UTC); document it; avoid shifting by 1 hour when persisting. |
| 6 | Tournament | **Tournament teams endpoint** | Provide endpoint or field that returns teams registered/linked to a tournament (e.g. `GET /tournaments/:id/teams` or `tournamentTeams` in tournament detail). |
| 7 | Teams | **Team logo storage** | Accept and store team logo (URL or file) and return it in team API (e.g. `logo` field). |
| 8 | Teams | **Assign existing player to team** | Endpoint to add existing player to team roster (e.g. by player id + team id). |
| 9 | Teams | **Captain flag** | Support a "captain" flag on team–player relationship (or player in context of team). |
| 10 | Players | **Gender in bulk upload Excel** | Add "gender" column to expected Excel schema; parse and store gender when processing bulk upload. |
| 11 | Players | **Bulk upload – auto-add to team** | When bulk upload includes destination team, associate created/linked players with that team (roster/teamId) so they appear under Teams → team → players. |
| 12 | Players | **Duplication – merge API** | Return possible duplicate matches in `PlayerUploadResult` with confidence level or flag; support "merge with existing" action. |
| 13 | Players | **Player teamId after registration** | If team name does not show on player card after registering to team, ensure API returns `teamId` (and team info) for player list. |
| 14 | Users | **Role in profile/auth** | Profile/auth response must include `role` so frontend can redirect statistician and restrict admin role dropdown. |
| 15 | Users | **Reject admin creating admins/superadmins** | Enforce permission: only SUPER_ADMIN can create ADMIN or SUPER_ADMIN; reject creation of higher/same-level roles by ADMIN. |

---

## Both (Backend + Frontend) tasks

Each row has a **Backend** part and a **Frontend** part. Do backend first, then frontend.

---

### Tournament tab

| # | Task | Backend | Frontend |
|---|------|---------|----------|
| B1 | **Division pop-up / duplicates** | Idempotency or duplicate check on create competition. | Fix validation so selecting division clears error; disable submit while request in flight to prevent double-submit. |
| B2 | **Scheduled showing as ongoing** | Ensure match status (SCHEDULED vs LIVE) and listing are correct. | Only show "Ongoing" when `status === 'LIVE'`; do not use first match as ongoing (already done: `ongoingMatch = matches.find(m => m.hasStarted) ?? null`). |
| B3 | **Assign Statistician fetch** | Expose/ensure statistician list API. | In `PendingGames.tsx` replace hardcoded list with `useStatisticians()` and use in Assign Statistician UI. |
| B4 | **Schedule time +1 hour** | Store/return in single timezone (e.g. UTC); no extra hour shift. | In `Fixtures.tsx` build `scheduledDate` from local date+time without extra hour; use explicit parsing (avoid ambiguous `new Date()` as UTC). |
| B5 | **Home/away teams = tournament teams only** | Provide tournament teams (e.g. `GET /tournaments/:id/teams` or in tournament detail). | In `Fixtures.tsx` use that list for home/away dropdowns instead of `useTeams()` (all teams). |

---

### Teams tab

| # | Task | Backend | Frontend |
|---|------|---------|----------|
| B6 | **Team logo** | Accept/store logo; return in team API (`logo`). | Logo upload/URL on team create/edit; display on team profile (`TeamDetails.tsx` has placeholder). |
| B7 | **Add Player = existing players** | Endpoint to assign existing player to team (player id + team id). | In `TeamDetails.tsx` replace "Add Player" create form with searchable dropdown of existing players (`usePlayers()`) and "Add to team" action. |
| B8 | **Team captain** | Captain flag on team–player (or player-in-team). | In Team Details players tab, UI to mark one player as captain (e.g. star/checkbox) and call API to persist. |

---

### Players tab

| # | Task | Backend | Frontend |
|---|------|---------|----------|
| B9 | **Low-confidence duplicates** | Return possible duplicates in `PlayerUploadResult` with confidence/flag; support merge action. | In upload result UI, show these (not only "duplicates skipped"); let admin compare and choose "Merge" or "Create new". |

---

### Users tab

| # | Task | Backend | Frontend |
|---|------|---------|----------|
| B10 | **Statistician not in Admin workspace** | Profile/auth includes `role`. | In `wrapper.tsx`, if role is STATISTICIAN redirect to statistician-only area; do not render full admin sidebar/routes (or render limited menu). |
| B11 | **Admin cannot add admins/superadmins** | Only SUPER_ADMIN can create ADMIN/SUPER_ADMIN; reject otherwise. | In `Users.tsx` when current user is ADMIN, hide or disable SUPER_ADMIN (and optionally ADMIN) in role dropdown for create/edit. |

---

## Suggested order

1. **Backend-first (unblock frontend):**  
   Profile `role` (B10/B11), tournament flyer (1), tournament teams (6), statistician list (4), schedule time (5), match status (3), division idempotency (2), team logo (7), assign player to team (8), captain (9), gender Excel (10), bulk-upload team (11), duplication/merge API (12), player teamId (13), reject admin creating admins (15).

2. **Then frontend for “Both” items:**  
   Division validation (B1), assign statistician UI (B3), schedule time parsing (B4), tournament teams dropdown (B5), team logo UI (B6), add existing player UI (B7), captain UI (B8), duplicate low-confidence UI (B9), statistician redirect/menu (B10), admin role dropdown (B11).

3. **Scheduled vs ongoing (B2):** Backend match status + frontend display logic (frontend already updated to only show ongoing when `hasStarted`).

Use this list to assign and track backend vs frontend work and to implement in the right order.
