# Frontend vs Backend Work Categorization

Below is each item from your list with a clear **Frontend**, **Backend**, or **Both** label and short notes. Where useful, file paths or behavior are cited.

---

## MAIN DASHBOARD

| Item | Layer | Notes |
|------|--------|------|
| "Welcome back UserName" instead of "Welcome back UserMail" | **Frontend** | Dashboard already uses `profileData?.name ?? profileData?.email ?? 'User'` in `dashboard.tsx` (lines 80–81, 119–122). If email still shows, either the profile API does not return `name` (then **Backend**: ensure `/profile` or auth response includes `name`) or another UI uses email explicitly; confirm and fix on frontend to prefer and display `name`. |

---

## TOURNAMENT TAB

| Item | Layer | Notes |
|------|--------|------|
| Uploaded tournament flyer not displaying with tournament (KCBL default) | **Backend** | Frontend uses hardcoded `/flyer.png` in `TournamentsListing.tsx` (line 249). Backend must accept/store flyer (e.g. URL or file) and return it in tournament payload (`flyer` in api.ts). Frontend can then show `tournament.flyer` when present. |
| Division pop-up blocks creating competition; duplicates created in background | **Frontend + Backend** | **Frontend**: Fix validation so selecting a division does not keep showing the error and does not allow double-submit (disable submit while request in flight, clear error on valid selection). **Backend**: Idempotency or duplicate check so multiple rapid creates do not create duplicate competitions. |
| Scheduled game showing as ongoing game | **Both** | **Backend**: Ensure match `status` is correct (e.g. SCHEDULED vs LIVE) and that listing/query filters or sorts by status correctly. **Frontend**: In `Tournaments.tsx` line 103, `ongoingMatch = matches.find((m) => m.hasStarted) ?? matches[0]` falls back to first match when none is LIVE — only show "Ongoing" when `status === 'LIVE'` (or equivalent); do not use first match as ongoing. |
| Copy match code icon not showing on scheduled match card (before click) | **Frontend** | Add a visible copy-match-code icon on each scheduled match card in the Schedules list (e.g. in `Schedules.tsx` or tournament schedule section in `Tournaments.tsx`) so users can copy without opening the match. |
| Schedule game click should go to assign statistician / copy match code / countdown page, not live game | **Frontend** | When user clicks a **scheduled** match (not live), navigate to a "pending/setup" page (e.g. `/tournaments/:id/match/:matchId/pending` as in wrapper) instead of the live match page. Use match `status` to decide: SCHEDULED → pending page; LIVE/COMPLETED → match page. Dashboard "Up-Next" already behaves correctly; apply same logic to Schedule list click. |
| Assign Statistician should fetch existing statisticians | **Both** | **Backend**: Expose list of statisticians (or ensure existing statistician API is used for assignee dropdown). **Frontend**: In `PendingGames.tsx` replace hardcoded statistician list with data from `useStatisticians()` (or equivalent) and use it in the Assign Statistician UI. |
| Schedule time adds 1 hour to selected time (e.g. 11:30 PM → 12:30 PM) | **Both** | **Backend**: Store and return times in a single timezone (e.g. UTC) and document it; avoid shifting by 1 hour when persisting. **Frontend**: When building `scheduledDate` (e.g. in `Fixtures.tsx` line 95), use local date + time without applying an extra hour; use explicit date/time parsing (e.g. avoid `new Date()` with ambiguous string that might be interpreted as UTC). |
| After creating tournament, Group A comes with preloaded teams | **Frontend** | Do not preload teams into Group A by default when creating a tournament (or make it configurable). Adjust create-tournament flow so groups start empty unless explicitly added. |
| When creating a match, only teams registered in that tournament in home/away dropdown | **Both** | **Backend**: Provide an endpoint or field that returns teams registered/linked to a given tournament (e.g. `GET /tournaments/:id/teams` or `tournamentTeams` in tournament detail). **Frontend**: In `Fixtures.tsx` use that list for home/away dropdowns instead of `useTeams()` (all teams). |

---

## TEAMS TAB

| Item | Layer | Notes |
|------|--------|------|
| Place to add team logo | **Both** | **Backend**: Accept and store team logo (URL or file) and return it in team API (e.g. `logo` field). **Frontend**: Add logo upload/URL input on team create/edit and display it on team profile (e.g. `TeamDetails.tsx` already has `teamData.logo` placeholder). |
| Add Player in Team's player tab = dropdown to search/select existing players | **Both** | **Backend**: Endpoint to assign existing player to team (e.g. add to roster by player id + team id). **Frontend**: In `TeamDetails.tsx` replace "Add Player" form that creates new player with a searchable dropdown of existing players (from `usePlayers()` or similar) and "Add to team" action. |
| Add way to select team captain in Team's players tab | **Both** | **Backend**: Support a "captain" flag on team–player relationship (or player in context of team). **Frontend**: In Team Details players tab, add UI to mark one player as captain (e.g. star/checkbox) and call API to persist. |

---

## PLAYERS TAB

| Item | Layer | Notes |
|------|--------|------|
| Replace release icon with delete icon on player card (revert previous UI change) | **Frontend** | In `Players.tsx` the "Remove from team" action uses `FiTrash` (lines 414–419); the "Delete player" action also uses `FiTrash`. Use a distinct icon for "Release/Remove from team" (e.g. user-minus or exit) and keep delete icon only for "Delete player". |
| Clicking player card should navigate to player profile | **Frontend** | Currently `Players.tsx` `handlePlayerClick` navigates to team: `navigate(\`/teams-management/${player.teamId}\`)`. Add a player profile route (e.g. `/players-management/:playerId` or reuse existing player detail page if any) and navigate there on card/row click. |
| Team name not linked / not showing on player card after registering to team | **Frontend** | Ensure player list gets `teamId`/team name from API and displays it (already mapped in Players.tsx via `teamMap`). If API does not return `teamId` after registration, that's **Backend**. If it does, make team name a link to that team's profile. |
| Add gender in bulk upload Excel format | **Backend** | Add a "gender" column to the expected Excel schema and document it; parse and store gender when processing bulk upload. |
| Player not auto-added to team after selecting destination team in bulk upload | **Backend** | When bulk upload includes a destination team, ensure created/linked players are actually associated with that team (roster/teamId) so they appear under Teams → team → players. |
| Duplication detection: show low-confidence possible duplicates; let admin merge or create | **Both** | **Backend**: Return possible duplicate matches (e.g. in `PlayerUploadResult`) with a confidence level or flag; support a "merge with existing" action. **Frontend**: Show these in upload result UI (not only "duplicates skipped"), let admin compare and choose "Merge" or "Create new". |

---

## USERS TAB

| Item | Layer | Notes |
|------|--------|------|
| Statistician login must not enter Admin/SuperAdmin workspace | **Both** | **Backend**: Profile/auth response must include `role`. **Frontend**: In `wrapper.tsx` (or router), after login, if role is STATISTICIAN redirect to a statistician-only area and do not render admin sidebar/routes (or render a limited menu). |
| Admin must not be able to add other admins/superadmins | **Both** | **Backend**: Enforce permission: only SUPER_ADMIN can create ADMIN or SUPER_ADMIN; reject creation of higher/same-level roles by ADMIN. **Frontend**: In `Users.tsx` when current user is ADMIN, hide or disable SUPER_ADMIN (and optionally ADMIN) in the role dropdown for create/edit. |

---

## Summary by layer

- **Frontend only:** Welcome text (if API has name), copy match code icon on card, schedule click → pending page, Group A preload, release vs delete icon, player card → profile, team name link on player card, duplicate low-confidence UI, statistician redirect/UI, admin role dropdown restrictions.

- **Backend only:** Flyer storage/return, division duplicate prevention, match status correctness, statistician list for assign, time storage/format, tournament-teams endpoint, team logo storage, assign player to team API, captain flag, gender in Excel, bulk-upload team assignment, duplicate/match API for merge, role in profile, reject admin creating admins/superadmins.

- **Both:** Division validation + idempotency, scheduled vs ongoing display, assign statistician fetch, schedule time +1h fix, tournament teams for match creation, team logo upload UI, add existing player UI, captain selection UI, player teamId/team name (if missing from API), low-confidence duplicates (API + UI), statistician workspace (auth + routes), admin cannot add admins (API + UI).

Use this table to assign work to frontend vs backend and to implement in the right order (e.g. backend endpoints before frontend that consumes them).
