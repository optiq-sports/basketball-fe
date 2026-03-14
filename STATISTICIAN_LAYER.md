# Statistician Layer — Technical Reference

This document covers every screen, data flow, wizard, and backend contract for the **Statistician** role in the Basketball Frontend application. Use it as the single source of truth when wiring the backend so that the statistician layer works end-to-end without any frontend changes.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Role-Based Access Control](#3-role-based-access-control)
4. [Navigation Flow](#4-navigation-flow)
5. [Page Reference](#5-page-reference)
   - [5.1 Match Key](#51-match-key--match-key)
   - [5.2 Starters](#52-starters--starters)
   - [5.3 Choose Sides](#53-choose-sides--choose-sides)
   - [5.4 Jump Ball](#54-jump-ball--jump-ball)
   - [5.5 Stat Dashboard](#55-stat-dashboard--stat-dash)
6. [Stat Dashboard — Component Breakdown](#6-stat-dashboard--component-breakdown)
   - [6.1 Menu Bar](#61-menu-bar)
   - [6.2 Scoreboard](#62-scoreboard)
   - [6.3 Court Section](#63-court-section)
   - [6.4 Game Log](#64-game-log)
7. [Wizard Flows](#7-wizard-flows)
   - [7.1 Made Shot (Right-Click)](#71-made-shot-wizard-right-click)
   - [7.2 Missed Shot (Left-Click)](#72-missed-shot-wizard-left-click)
   - [7.3 Foul Wizard (FOUL button)](#73-foul-wizard-foul-button)
   - [7.4 Turnover Wizard (TURNOVER button)](#74-turnover-wizard-turnover-button)
   - [7.5 Substitution Modal (SUB button)](#75-substitution-modal-sub-button)
   - [7.6 Timeout Modal (T/O button)](#76-timeout-modal-to-button)
8. [Data Models](#8-data-models)
9. [Backend API Contracts](#9-backend-api-contracts)
   - [9.1 Authentication](#91-authentication)
   - [9.2 Match Key Validation](#92-match-key-validation)
   - [9.3 Match Setup Data](#93-match-setup-data)
   - [9.4 Stat Event Submission](#94-stat-event-submission)
   - [9.5 Substitution Submission](#95-substitution-submission)
   - [9.6 Period / Clock Management](#96-period--clock-management)
10. [What Is Currently Mocked](#10-what-is-currently-mocked)
11. [Frontend Todos for Full Backend Integration](#11-frontend-todos-for-full-backend-integration)

---

## 1. Overview

The Statistician Layer is an isolated, role-gated set of screens that allows a user with the role **`STATISTICIAN`** to:

- Enter a **match key** to join a live game.
- Confirm **starting lineups** for both teams.
- Set **shooting sides** on the court.
- Record the **jump ball** result.
- Track every **in-game stat** in real time via an interactive court and multi-step wizards.

The layer is fully separated from the regular dashboard flow. Non-statisticians are redirected away from all these routes.

---

## 2. Tech Stack

| Concern | Library |
|---|---|
| UI Framework | React 18 + TypeScript |
| Routing | `react-router-dom` v6 |
| Data Fetching | `@tanstack/react-query` (`useQuery`, `useMutation`) |
| Styling | Tailwind CSS |
| Court Graphics | Custom SVG (`viewBox="0 0 600 360"`) |
| Icons | `react-icons/fi` (Feather icons) |
| Auth Storage | `localStorage` key `access_token` |
| Device Status | Web Battery Status API + `navigator.onLine` |

---

## 3. Role-Based Access Control

### Detection

The app calls `GET /profile` on initial load (via `useProfile` hook). The returned object must include:

```json
{
  "id": "...",
  "name": "Ibrahim Maina",
  "role": "STATISTICIAN"
}
```

### Redirect Logic

| Where | Condition | Behaviour |
|---|---|---|
| `wrapper.tsx` (main layout) | `role === 'STATISTICIAN'` | Redirect to `/match-key` |
| `MatchKey.tsx` | `role !== 'STATISTICIAN'` | Redirect to `/dashboard` |

### Routes

All statistician routes are individually **protected** (require `access_token` in `localStorage`). Non-authenticated users are redirected to `/login`.

```
/match-key      → MatchKey page
/starters       → Starters page
/choose-sides   → ChooseSides page
/jump-ball      → JumpBall page
/stat-dash      → StatDash page
```

---

## 4. Navigation Flow

```
Login
  │
  └─► (role = STATISTICIAN)
        │
        ▼
  /match-key        Enter match key + view recent games
        │
        ▼
  /starters         Confirm starting 5 for each team
        │
        ▼
  /choose-sides     Set shooting sides + court type
        │
        ▼
  /jump-ball        Pick jump ball players + winner
        │
        ▼ (winner selected)
  /stat-dash        Live game tracking dashboard
```

Back navigation is always available (Back button, top-left) on `/choose-sides` and `/jump-ball`.

---

## 5. Page Reference

### 5.1 Match Key — `/match-key`

**File:** `src/pages/matchKey/MatchKey.tsx`

**Purpose:** Authenticate into a specific game session. Shows recent games for convenience.

#### UI Elements

| Element | Behaviour |
|---|---|
| Welcome banner | Displays `profileData.name`, fetched from `GET /profile` |
| Match Key input | Free-text field (currently accepts any non-empty string) |
| Continue button | Validates key is non-empty → navigates to `/starters` |
| Recent Games list | Shows last 5 matches sorted by `scheduledDate` descending |
| Recent game row | Click navigates to `/tournaments/:tournamentId/match/:matchId` |

#### Current Mock Behaviour

`handleContinue` navigates directly to `/starters` without API validation. The match key is **not** currently sent to the backend.

#### Backend Integration Required

```
POST /matches/validate-key
Body:   { "matchKey": "ABC-1234" }
Returns:
  200: { "matchId": "...", "homeTeamId": "...", "awayTeamId": "..." }
  404: { "error": "Invalid match key" }
```

On success, store the returned `matchId` (e.g. in context or query state) and navigate to `/starters`.

#### Data Consumed

```typescript
// useMatches() → GET /matches
interface Match {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledDate: string;  // ISO 8601
  venue?: string;
  totalHome?: number;
  totalAway?: number;
}

// useTeams() → GET /teams
interface Team {
  id: string;
  name: string;
  color: string;  // hex string e.g. "#E63946"
}
```

---

### 5.2 Starters — `/starters`

**File:** `src/pages/staters/Starts.tsx`

**Purpose:** Let the statistician confirm which players start for each team.

#### UI Elements

| Element | Behaviour |
|---|---|
| Two-column grid | Team 1 (left) and Team 2 (right) |
| Team header pill | Shows team name and team colour |
| Player rows | Jersey #, player photo, first + last name |
| Starter checkbox | Toggle on/off — checked = starter |
| Team Color swatch | Displays team colour (read-only) |
| Continue button | Fixed top-right → `/choose-sides` |

#### Current Mock Behaviour

Rosters are **hard-coded** mock data (12 players per team, all named "Name Surname", jersey #8). Team colours are hardcoded `#E63946` / `#D4A017`.

#### Backend Integration Required

The page should receive the real roster from the match setup:

```
GET /matches/:matchId/roster
Returns:
{
  "homeTeam": {
    "id": "...",
    "name": "Bulls",
    "color": "#E63946",
    "players": [
      { "id": "p1", "jerseyNumber": 5, "firstName": "Ibrahim", "lastName": "Maina", "isStarter": true },
      ...
    ]
  },
  "awayTeam": { ... }
}
```

On Continue, submit the final starter selections:

```
POST /matches/:matchId/starters
Body:
{
  "homeTeamStarters": ["p1", "p2", "p3", "p4", "p5"],
  "awayTeamStarters": ["p6", "p7", "p8", "p9", "p10"]
}
```

---

### 5.3 Choose Sides — `/choose-sides`

**File:** `src/pages/choose/ChooseSides.tsx`

**Purpose:** Set which basket each team attacks toward for the first half.

#### UI Elements

| Element | Behaviour |
|---|---|
| Court SVG | Full interactive basketball court (`viewBox="0 0 620 340"`) |
| Arrow overlays | Coloured directional arrows showing each team's attacking direction |
| Centre ⇄ button | Click to swap teams' sides |
| Type 1 / Type 2 radio | Toggle attack direction convention |
| Team labels (bottom) | Show current left/right assignment |
| Back (top-left) | → `/starters` |
| Continue (top-right) | → `/jump-ball` |

#### Court Types

| Type | Description |
|---|---|
| Type 1 | Each team attacks toward their own side's basket |
| Type 2 | Teams attack toward the **opposite** basket (arrows flip inward) |

#### Current Mock Behaviour

Side assignments are local state only. The `swapped` boolean and `courtType` are not persisted.

#### Backend Integration Required

```
POST /matches/:matchId/sides
Body:
{
  "homeTeamSide": "left" | "right",
  "courtType": 1 | 2
}
```

---

### 5.4 Jump Ball — `/jump-ball`

**File:** `src/pages/Jump/JumpBall.tsx`

**Purpose:** Record the opening jump ball — which players jump and which team wins possession.

#### UI Elements

| Element | Behaviour |
|---|---|
| Player buttons (1–5) each team | Select the jumping player; click again to deselect |
| Selected tiles | Show the two picked players side by side |
| TEAM 1 / TEAM 2 winner buttons | Highlight the winning team with a ring |
| Continue button | Only visible when both players **and** a winner are selected → `/stat-dash` |
| Back (top-left) | → `/choose-sides` |

#### Current Mock Behaviour

Players are numbered 1–5 for both teams (no names). Winner selection is local state only.

#### Backend Integration Required

```
POST /matches/:matchId/jump-ball
Body:
{
  "homePlayerJerseyNumber": 3,
  "awayPlayerJerseyNumber": 7,
  "winner": "home" | "away"
}
```

On success, navigate to `/stat-dash` and pre-set the initial possession to the winning team.

---

### 5.5 Stat Dashboard — `/stat-dash`

**File:** `src/pages/stat/StatDash.tsx`

**Purpose:** The primary live game tracking screen. All stat recording happens here.

#### Top-Level State

| State | Type | Description |
|---|---|---|
| `team1Score` | `number` | Home team cumulative score |
| `team2Score` | `number` | Away team cumulative score |
| `quarter` | `number` | Current period (1–4+) |
| `timeLeft` | `number` | Seconds remaining in period (600 = 10 min) |
| `isRunning` | `boolean` | Whether the game clock is counting down |
| `events` | `GameEvent[]` | Ordered game log (newest first) |
| `possession` | `1 \| 2` | Which team currently has ball |
| `selectedTeam1Player` | `number \| null` | Jersey number of highlighted T1 player |
| `selectedTeam2Player` | `number \| null` | Jersey number of highlighted T2 player |
| `showSub` | `boolean` | Controls SubstitutionModal visibility |
| `showTimeout` | `boolean` | Controls TimeoutModal visibility |

#### Team Colours (hardcoded, replace with backend values)

```typescript
const TEAM_1_COLOR = '#E63946';  // red
const TEAM_2_COLOR = '#D4A017';  // gold
```

#### Clock Implementation

The countdown uses `Date.now()` as the reference point (not a frame counter), polled every **100 ms**, so the displayed time never drifts more than 100 ms from real time.

```typescript
// On start:
startEpochRef.current = Date.now();
startValueRef.current = timeLeft;

// Each 100 ms tick:
const elapsed = Math.floor((Date.now() - startEpochRef.current) / 1000);
const remaining = Math.max(0, startValueRef.current - elapsed);
setTimeLeft(remaining);
```

#### Game Event Shape

```typescript
interface GameEvent {
  id: string;        // Date.now().toString()
  period: string;    // "Q1", "Q2", etc.
  clock: string;     // "MM:SS" at time of event
  team: string;      // team name string
  player: string;    // "#N Player Name" or empty
  action: string;    // event type label
  result: string;    // detail / outcome
}
```

---

## 6. Stat Dashboard — Component Breakdown

### 6.1 Menu Bar

**File:** `src/pages/stat/components/MenuBar.tsx`

Dropdown navigation bar at the very top (above the scoreboard). Five menus:

| Menu | Items |
|---|---|
| FILE | New Game, Open Game, Save, Save As, Export PDF, Exit |
| GAME | Period Management, Edit Score, Add Penalty, Clear Stats |
| REPORTS | Game Summary, Player Stats, Team Stats, Shot Chart, Export |
| SETTINGS | Display Settings, Timer Settings, Court Settings |
| HELP | User Guide, Keyboard Shortcuts, About |

Click outside any open menu closes it (via `useEffect` on `document.mousedown`).

---

### 6.2 Scoreboard

**File:** `src/pages/stat/components/Scoreboard.tsx`

#### Layout (left → right)

```
[TEAM 1 card]  [Clock section]  [TEAM 2 card]
```

#### Clock Section (top → bottom)

```
[1st QUARTER label]  [🔋 CHARGING 80%]  [📶 CONNECTED]
[  09:22 timer  ]
[  START / STOP  ]
[T/O]  [JUMP-BALL]  [SUB]
```

#### Props

```typescript
interface ScoreboardProps {
  team1Name: string;
  team1Score: number;
  team1Color: string;
  team2Name: string;
  team2Score: number;
  team2Color: string;
  quarter: number;
  timeLeft: number;          // seconds
  isRunning: boolean;
  onToggleClock: () => void;
  onAdjustTime: (delta: number) => void;  // ±30 seconds
  onTimeout: () => void;     // opens TimeoutModal + stops clock
  onJumpBall: () => void;    // logs jump ball event
  onSub: () => void;         // opens SubstitutionModal
}
```

#### Device Status (real data, no mock)

- **Battery**: `navigator.getBattery()` (Chrome/Edge only). Shows level % and charging state.
- **Network**: `navigator.onLine` + `online`/`offline` events.

---

### 6.3 Court Section

**File:** `src/pages/stat/components/CourtSection.tsx`

This is the largest component. It contains the interactive court, both team stat tables, possession toggle, and all stat wizards.

#### Layout

```
[Team 1 Stats Table]  [Court + Possession Toggle]  [Team 2 Stats Table]
[FOUL] [TURNOVER]     [GrayCourt SVG]              [FOUL] [TURNOVER]
```

#### Player Stats Table (each side)

Columns: **#** | **PLAYER NAME** | **PF** | **PTS**

- PF is **red** when > 0.
- PTS is **blue** when > 0.
- Clicking a row selects that player (highlighted with team colour tint).
- When a player is selected, the court **only shows that player's markers** (filtered by `playerNum` + `playerTeam` on each `CourtMarker`).

#### Possession Toggle

A horizontal bar above the court:

```
[ TEAM 1 ◀ ]  BALL  [ ▶ TEAM 2 ]
```

The active team's button is filled with its team colour. Clicking either button toggles possession. Possession affects which players appear first in all wizard player lists.

#### Props

```typescript
interface CourtSectionProps {
  team1Color: string;
  team2Color: string;
  team1Name?: string;
  team2Name?: string;
  possession: 1 | 2;
  onTogglePossession: () => void;
  selectedTeam1Player: number | null;
  selectedTeam2Player: number | null;
  onSelectTeam1Player: (n: number) => void;
  onSelectTeam2Player: (n: number) => void;
  onFoul1: () => void;
  onTurnover1: () => void;
  onFoul2: () => void;
  onTurnover2: () => void;
  onAddEvent?: (team: string, player: string, action: string, result: string) => void;
}
```

#### Court SVG (`GrayCourt`)

- `viewBox="0 0 600 360"`, `height="100%"`, `preserveAspectRatio="xMidYMid meet"`.
- A transparent overlay `<rect>` captures all clicks/right-clicks and converts screen coordinates → SVG coordinates via `svgEl.getScreenCTM().inverse()`.
- **Left-click** → `onCourtLeftClick(svgX, svgY)` → opens **Missed Shot Wizard**.
- **Right-click** → `onCourtRightClick(svgX, svgY)` → opens **Made Shot Wizard**.

#### Court Markers

```typescript
interface CourtMarker {
  id: string;
  x: number;           // SVG X coordinate
  y: number;           // SVG Y coordinate
  type: 'shot' | 'foul' | 'missed';
  color: string;       // hex fill colour
  label: string;       // shot type name
  playerNum?: number;  // jersey number of the player
  playerTeam?: 1 | 2;  // which team
}
```

| Type | Visual |
|---|---|
| `shot` | Filled circle, colour = shot type colour |
| `missed` | Hollow circle with diagonal slash, grey or red (blocked) |
| `foul` | × mark |

#### Live Per-Player Stats (internal state)

```typescript
// key = `${team}-${num}`  e.g. "1-5"
playerStats: Record<string, { pts: number; pf: number }>
```

Updated automatically as wizards complete:
- **Made shot** → `addPts(team, num, shotOption.points)`
- **Made free throw** → `addPts(receiverTeam, receiverNum, 1)`
- **Foul committed** → `addPf(foulerTeam, foulerNum)`

---

### 6.4 Game Log

**File:** `src/pages/stat/components/GameLog.tsx`

A compact 112 px strip at the bottom of the screen, scrollable, newest events at the top.

Columns: **Period** | **Clock** | **Team** | **Player** | **Action** | **Result**

---

## 7. Wizard Flows

All wizards are full-screen overlays (`z-[900]`). They block the court while open. Only one wizard can be open at a time — opening one closes any other.

---

### 7.1 Made Shot Wizard (Right-Click)

Triggered by: **right-click anywhere on the court**.

**3 steps, shown as 3 side-by-side panels:**

```
Step 0 — SELECT PLAYER
  • All on-court players grouped: Offensive team first (possession), then Defensive team.
  • Each player shown as colour-dot + name.

Step 1 — SELECT SHOT TYPE + FAST BREAK
  • Options: Jump Shot (2pt), Layup (2pt), Dunk (2pt), Fast Shot (2pt), 3-Pointer (3pt), Free Throw (1pt)
  • Each has a distinct colour used for the court marker.
  • FAST BREAK toggle (ON/OFF) adds a "fast break" label to the event.

Step 2 — SELECT ASSIST PLAYER (or No Assist)
  • Shows all players except the shooter.
  • "No Assist" option at top.
```

**On complete:**
- `addPts(player.team, player.num, shotOption.points)` — updates live stats table.
- Adds a `'shot'` marker at click coordinates.
- Calls `onAddEvent(team, player, shotType, result)`.

**Shot options data:**

```typescript
const SHOT_OPTIONS = [
  { name: 'Jump Shot', color: '#3b82f6', points: 2 },
  { name: 'Layup',     color: '#10b981', points: 2 },
  { name: 'Dunk',      color: '#ef4444', points: 2 },
  { name: 'Fast Shot', color: '#f59e0b', points: 2 },
  { name: '3-Pointer', color: '#8b5cf6', points: 3 },
  { name: 'Free Throw',color: '#0891b2', points: 1 },
];
```

---

### 7.2 Missed Shot Wizard (Left-Click)

Triggered by: **left-click anywhere on the court**.

**Up to 5 steps (branches on "Blocked"):**

```
Step 0 — SELECT PLAYER WHO MISSED
  • All on-court players (offensive team first).

Step 1 — SELECT MISSED SHOT TYPE + FAST BREAK
  • Options: Jump Shot, Layup, Dunk, Post Shot

Step 2 — SELECT REBOUND / OUTCOME
  • Options: Tip-In Layup Made, Tip-In Layup Miss, Tip-In Dunk Made,
             Tip-In Dunk Miss, Out of Bounce, 24 Secs Violation, Blocked

  ┌── If "Blocked" ──────────────────────────────────────┐
  │                                                       │
  │  Step 3 — SELECT BLOCK PLAYER (from defensive team)  │
  │                                                       │
  │  Step 4 — SELECT ORIGINAL MISSED PLAYER              │
  │           (confirms the sequence)                     │
  └───────────────────────────────────────────────────────┘
  │
  └── If any other outcome → complete immediately
```

**On complete (non-blocked):**
- Adds a `'missed'` marker (grey hollow circle) at click coordinates.
- Logs: `{shotType} (missed)` / `{outcome}`.

**On complete (blocked):**
- Adds a `'missed'` marker (red, labelled "Blocked").
- Logs two events: the blocked shot + the block.

---

### 7.3 Foul Wizard (FOUL button)

Triggered by: **FOUL button** under Team 1 or Team 2 stat table.

**6 steps split across two 3-panel views:**

#### View 1 (Steps 0–2)

```
Panel 0 — SELECT PLAYER FOR FOUL (fouler)
  • All players from the fouling team.
  • Also: BENCH, COACH buttons.

Panel 1 — FOUL TYPE
  • Personal, Shooting, Technical,
    Unsportsmanlike, Double Foul, Offensive

Panel 2 — SELECT PLAYER FOR RECEIVED FOUL (receiver)
  • All players from the opposing team.
```

#### View 2 (Steps 3–5)

```
Panel 3 — FREE THROWS AWARDED
  • 1 Free Throw, 2 Free Throws, 3 Free Throws, No Free Throw
  • If "No Free Throw" → wizard completes immediately here.

Panel 4 — PLAYER FOR ASSIST
  • Any player, or "No Assist"

Panel 5 — FREE THROW RESULTS
  • One Made/Missed button per free throw attempt.
  • "Complete" button appears only when all results are entered.
```

**On complete:**
- `addPf(foulerTeam, foulerNum)` — PF++ for the fouler.
- `addPts(receiverTeam, receiverNum, 1)` per **made** free throw.
- Logs the foul event + one event per free throw attempt.

---

### 7.4 Turnover Wizard (TURNOVER button)

Triggered by: **TURNOVER button** under Team 1 or Team 2 stat table.

**3 steps:**

```
Step 0 — SELECT PLAYER FOR TURNOVER
  • All players from the turning-over team.

Step 1 — SELECT TURNOVER TYPE
  • Ball Handling, Bad Pass, Double Dribble, Travel,
    Out of Bounce, Back Court, 3 Seconds, 8 Seconds, 24 Seconds

Step 2 — SELECT STEAL PLAYER (or No Steal)
  • All players from the opposing team.
  • "No Steal" option at top.
```

**On complete:**
- Logs turnover event (includes type + steal player if applicable).
- If steal occurred, logs a separate steal event for the defending player.

---

### 7.5 Substitution Modal (SUB button)

Triggered by: **SUB button** in the Scoreboard action row. Stops the clock implicitly by disabling any in-progress action.

**Full-screen overlay showing both rosters:**

```
SUBSTITUTION
┌─────────────────────────────────────────────────────────┐
│ TEAM 1                       │              TEAM 2       │
│ Players On  [1][2][3][4][5]  │  [1][2][3][4][5] Players On │
│ Bench       [15][10][16][11][8]  │  [15][10][16][11][8] Bench   │
│             [9][30][23]      │  [9][30][23]              │
└─────────────────────────────────────────────────────────┘
[✕ Cancel]                              [Finish →]
```

**Interaction:**
1. Click a **Players On** tile → player moves to bench immediately (empty slot appears on court row).
2. Click a **Bench** tile (highlighted when slot exists) → fills the empty slot.
3. Only one pending swap per team at a time.
4. **Finish** → logs each swap as a `substitution` event: `#OUT ← #IN`.

**On complete (called with `SubEvent[]`):**

```typescript
interface SubEvent {
  team: 1 | 2;
  playerOut: number;   // jersey number leaving
  playerIn: number;    // jersey number entering
}
```

---

### 7.6 Timeout Modal (T/O button)

Triggered by: **T/O button** in Scoreboard. Also **stops the clock** immediately.

```
TIMEOUT
Who Took Time Out?
[ TEAM 1 ]   [ OFFICIALS ]   [ TEAM 2 ]
               [✕ Cancel]
```

- Clicking TEAM 1 / TEAM 2 / OFFICIALS logs a `timeout` event and closes.
- Clicking Cancel closes without logging anything (clock remains stopped).

---

## 8. Data Models

### Shot Types

| Name | Points | Colour |
|---|---|---|
| Jump Shot | 2 | `#3b82f6` (blue) |
| Layup | 2 | `#10b981` (green) |
| Dunk | 2 | `#ef4444` (red) |
| Fast Shot | 2 | `#f59e0b` (amber) |
| 3-Pointer | 3 | `#8b5cf6` (purple) |
| Free Throw | 1 | `#0891b2` (cyan) |

### Missed Shot Types

`Jump Shot` | `Layup` | `Dunk` | `Post Shot`

### Rebound / Post-Miss Outcomes

`Tip-In Layup Made` | `Tip-In Layup Miss` | `Tip-In Dunk Made` | `Tip-In Dunk Miss` | `Out of Bounce` | `24 Secs Violation` | `Blocked`

### Foul Types

`Personal` | `Shooting` | `Technical` | `Unsportsmanlike` | `Double Foul` | `Offensive`

### Turnover Types

`Ball Handling` | `Bad Pass` | `Double Dribble` | `Travel` | `Out of Bounce` | `Back Court` | `3 Seconds` | `8 Seconds` | `24 Seconds`

### GameEvent (sent to backend)

```typescript
interface GameEvent {
  matchId: string;
  period: string;          // "Q1"–"Q4", "OT1", etc.
  clockSeconds: number;    // seconds remaining when event occurred
  team: string;            // team name or "Officials"
  playerJerseyNumber?: number;
  playerName?: string;
  action: string;          // see Action Types below
  result: string;          // detail string
  courtX?: number;         // SVG X coordinate (0–600) for shot/missed markers
  courtY?: number;         // SVG Y coordinate (0–360) for shot/missed markers
  fastBreak?: boolean;
  assistPlayerJerseyNumber?: number;
  assistPlayerName?: string;
}
```

### Action Types (value of `action` field)

| Action | Source |
|---|---|
| `"Jump Shot"` / `"Layup"` / `"Dunk"` / `"Fast Shot"` / `"3-Pointer"` / `"Free Throw"` | Made shot wizard |
| `"Jump Shot (missed)"` / `"Layup (missed)"` etc. | Missed shot wizard |
| `"Jump Shot blocked"` / `"Layup blocked"` etc. | Blocked shot |
| `"block"` | The blocking player's event |
| `"Personal foul"` / `"Shooting foul"` / `"Technical foul"` etc. | Foul wizard |
| `"FT 1/1"` / `"FT 1/2"` / `"FT 2/2"` etc. | Free throw result |
| `"turnover"` | Turnover wizard |
| `"steal"` | Turnover wizard — opposing player |
| `"substitution"` | Substitution modal |
| `"timeout"` | Timeout modal |
| `"jump ball"` | JUMP-BALL scoreboard button |

---

## 9. Backend API Contracts

All requests include:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

### 9.1 Authentication

```
POST /auth/login
Body:   { "email": "...", "password": "..." }
Returns: { "access_token": "...", "user": { "id": "...", "name": "...", "role": "STATISTICIAN" } }
```

```
GET /profile
Returns: { "id": "...", "name": "...", "role": "STATISTICIAN" }
```

---

### 9.2 Match Key Validation

```
POST /matches/validate-key
Body:   { "matchKey": "ABC-1234" }
200:    { "matchId": "uuid", "homeTeamId": "uuid", "awayTeamId": "uuid" }
404:    { "error": "Match not found" }
403:    { "error": "Match already in progress" }
```

Store `matchId` in React context or URL params for all subsequent calls.

---

### 9.3 Match Setup Data

```
GET /matches/:matchId/roster
Returns:
{
  "homeTeam": {
    "id": "uuid",
    "name": "Bulls",
    "color": "#E63946",
    "players": [
      {
        "id": "uuid",
        "jerseyNumber": 5,
        "firstName": "Ibrahim",
        "lastName": "Maina",
        "photoUrl": "https://...",
        "isStarter": true
      }
    ]
  },
  "awayTeam": { /* same shape */ }
}
```

```
POST /matches/:matchId/starters
Body:
{
  "homeTeamStarters": ["playerId1", "playerId2", "playerId3", "playerId4", "playerId5"],
  "awayTeamStarters": ["playerId6", "playerId7", "playerId8", "playerId9", "playerId10"]
}
200: { "ok": true }
```

```
POST /matches/:matchId/sides
Body:
{
  "homeTeamSide": "left",
  "courtType": 1
}
200: { "ok": true }
```

```
POST /matches/:matchId/jump-ball
Body:
{
  "homePlayerJerseyNumber": 3,
  "awayPlayerJerseyNumber": 7,
  "winner": "home"
}
200: { "ok": true, "initialPossession": "home" }
```

---

### 9.4 Stat Event Submission

Every wizard completion should POST an event (or batch of events) to the backend.

**Single event:**
```
POST /matches/:matchId/events
Body:
{
  "period": "Q1",
  "clockSeconds": 482,
  "team": "home" | "away",
  "playerJerseyNumber": 5,
  "action": "Jump Shot",
  "result": "2pt",
  "courtX": 312,
  "courtY": 180,
  "fastBreak": false,
  "assistPlayerJerseyNumber": 3
}
200: { "eventId": "uuid", "homeScore": 2, "awayScore": 0 }
```

**Batch (foul + free throws together):**
```
POST /matches/:matchId/events/batch
Body: { "events": [ ...array of event objects... ] }
200: { "eventIds": ["uuid1", "uuid2"], "homeScore": 0, "awayScore": 2 }
```

The backend should return the **updated scores** in every response so the frontend can sync `team1Score` / `team2Score` accurately.

---

### 9.5 Substitution Submission

```
POST /matches/:matchId/substitutions
Body:
{
  "period": "Q2",
  "clockSeconds": 300,
  "substitutions": [
    { "team": "home", "playerOutJerseyNumber": 5, "playerInJerseyNumber": 15 }
  ]
}
200: { "ok": true }
```

---

### 9.6 Period / Clock Management

```
POST /matches/:matchId/period/start
Body: { "period": "Q1" }
200: { "ok": true }

POST /matches/:matchId/period/end
Body: { "period": "Q1", "finalClockSeconds": 0 }
200: { "ok": true }

POST /matches/:matchId/timeout
Body: { "period": "Q2", "clockSeconds": 245, "calledBy": "home" | "away" | "officials" }
200: { "ok": true }
```

---

## 10. What Is Currently Mocked

The following items are **not yet wired to the backend** and must be replaced during integration:

| Item | Location | What to replace with |
|---|---|---|
| Match key validation | `MatchKey.tsx handleContinue` | `POST /matches/validate-key` |
| Team names & colours | `StatDash.tsx` constants | Loaded from match roster API |
| Player rosters | `CourtSection.tsx` `TEAM1_PLAYERS` / `TEAM2_PLAYERS` | Loaded from match roster API |
| Starters roster | `Starts.tsx` `INITIAL_TEAMS` | Loaded from `GET /matches/:id/roster` |
| Jump ball players | `JumpBall.tsx` numbers 1–5 | Loaded from confirmed starters |
| Score update on made shot | `StatDash.tsx` `team1Score` / `team2Score` local state | Synced from `POST /events` response |
| Score update on free throw made | Inside `CourtSection foulComplete` | Synced from `POST /events/batch` response |
| Game events storage | `StatDash.tsx useState<GameEvent[]>` | `POST /events` + optionally `GET /events` on reconnect |
| Per-player stats (PTS/PF) | `CourtSection playerStats` state | `POST /events` response or separate `GET /matches/:id/stats` |
| SubstitutionModal initial rosters | `SubstitutionModal.tsx` `INIT_COURT` / `INIT_BENCH` | Loaded from confirmed starters |
| Match key displayed in mock events | `StatDash MOCK_EVENTS` | Remove mock events on integration |

---

## 11. Frontend Todos for Full Backend Integration

In order of the game flow:

1. **Create a `MatchContext`** (or use React Query state) to pass `matchId`, `homeTeamId`, `awayTeamId`, and initial team/roster data across all statistician pages — currently each page is stateless.

2. **`MatchKey.tsx`**: Replace `handleContinue` with `POST /matches/validate-key`. Store the returned `matchId` in context. On error show the API error message.

3. **`Starts.tsx`**: Replace `INITIAL_TEAMS` with data from `GET /matches/:matchId/roster`. On Continue call `POST /matches/:matchId/starters` with the checked player IDs.

4. **`ChooseSides.tsx`**: On Continue call `POST /matches/:matchId/sides` with `homeTeamSide` and `courtType`.

5. **`JumpBall.tsx`**: Replace `PLAYERS [1–5]` with actual starter names from context. On Continue call `POST /matches/:matchId/jump-ball`. Set initial `possession` in StatDash from the response `initialPossession`.

6. **`StatDash.tsx`**: Load `team1Name`, `team2Name`, `team1Color`, `team2Color` from match context instead of constants. After every wizard completion, call the relevant event endpoint and sync scores from the response.

7. **`CourtSection.tsx`**: Replace `TEAM1_PLAYERS` / `TEAM2_PLAYERS` with props passed down from StatDash (loaded from the API roster). Pass `playerStats` updates back to StatDash via a callback so the parent can sync with the backend.

8. **`SubstitutionModal.tsx`**: Replace `INIT_COURT` / `INIT_BENCH` with the live roster passed as props from StatDash.

9. **Clock sync**: On period start/end, call `POST /matches/:matchId/period/start|end`. On timeout, call `POST /matches/:matchId/timeout`.

10. **Reconnect resilience**: On page reload, call `GET /matches/:matchId/events` to rebuild the game log and player stats from the server.

---

*Last updated: generated from source — `src/pages/matchKey/MatchKey.tsx`, `src/pages/staters/Starts.tsx`, `src/pages/choose/ChooseSides.tsx`, `src/pages/Jump/JumpBall.tsx`, `src/pages/stat/StatDash.tsx`, `src/pages/stat/components/CourtSection.tsx`, `src/pages/stat/components/Scoreboard.tsx`, `src/pages/stat/components/MenuBar.tsx`, `src/pages/stat/components/GameLog.tsx`, `src/pages/stat/components/SubstitutionModal.tsx`, `src/pages/stat/components/TimeoutModal.tsx`, `src/routes.tsx`.*
