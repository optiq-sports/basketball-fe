# Tasks Implementation Status

✓ = Implemented (done)  
☐ = Not yet done

---

## MAIN DASHBOARD

| Status | Task |
|--------|------|
| ✓ | **Welcome back UserName** (instead of UserMail) — frontend shows `name` when available from profile (`dashboard.tsx`, `wrapper.tsx`). |

---

## TOURNAMENT TAB

| Status | Task |
|--------|------|
| ☐ | Uploaded tournament flyer not displaying with tournament created (KCBL default) — **Backend** |
| ☐ | Division pop-up message after selecting division; competition duplicates in background — **Frontend + Backend** |
| ✓ | Scheduled game showing as ongoing game — **Frontend**: fixed so “Ongoing” only shows when match is LIVE (no fallback to first match). Backend may still need to ensure correct `status`. |
| ✓ | Copy match code icon not showing on scheduled match card (before clicking) — **Frontend**: copy icon added on schedule cards in `Tournaments.tsx` and `Schedules.tsx`. |
| ✓ | Schedule game click → navigate to assign statistician / copy match code / countdown (not live game); works from Up-Next on dashboard — **Frontend**: scheduled → `/pending`, live → match page. |
| ☐ | Assign Statistician should fetch existing statisticians — **Both** |
| ☐ | Schedule time adds 1 hour to selected time (e.g. 11:30 PM → 12:30 PM) — **Frontend and Backend** |
| ✓ | After creating tournament, Group A automatically comes with preloaded teams — **Frontend**: Group A now uses tournament `teamIds` only; empty if none. |
| ☐ | When creating a match, only teams registered in that tournament in home/away dropdown — **Both** |

---

## TEAMS TAB

| Status | Task |
|--------|------|
| ☐ | Place to add team logo — **Both** |
| ☐ | Add Player in Team’s player tab = dropdown to search/select existing players only — **Both** |
| ☐ | Add where to select team captain in Team’s players tab — **Both** |

---

## PLAYERS TAB

| Status | Task |
|--------|------|
| ✓ | Replace release icon with delete icon on player card (revert wrong icon) — **Frontend**: “Remove from team” uses `FiUserMinus`, “Delete player” uses `FiTrash`. |
| ✓ | System not navigating to player profile when you click on player card — **Frontend**: row click goes to `/players-management/:playerId`; `PlayerProfile` page and route added. |
| ✓ | Team name not linked/shown on player card after registering player to team — **Frontend**: team name is a link to team profile; displays from API. (If still missing, backend must return `teamId`.) |
| ☐ | Add gender in bulk upload Excel format — **Backend** |
| ☐ | Player not automatically added to team after selecting destination team in bulk upload — **Backend** |
| ☐ | Duplication: show lower-confidence matches and let admin merge or create new — **Both** |

---

## USERS TAB

| Status | Task |
|--------|------|
| ☐ | Statistician login should not navigate to Admin/SuperAdmin workspace — **Both** (statistician UI not done yet; create/login works). |
| ☐ | Admin should not be able to add other admins/superadmins — **Both** |

---

## Summary

- **Implemented (✓):** 9 items — Main dashboard welcome, scheduled vs ongoing (frontend), copy match code icon, schedule click → pending, Group A preload fix, release vs delete icon, player card → profile, team name link on player card.
- **Not implemented (☐):** 12 items — tournament flyer, division/duplicates, assign statistician fetch, schedule time +1h, tournament teams in dropdown, team logo, add player dropdown, captain, gender in Excel, bulk-upload team assignment, duplication low-confidence UI, statistician redirect, admin role restriction.
