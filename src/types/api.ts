// API Response Types
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
}

/**
 * Shape every list endpoint returns as of the Sep 2026 backend pagination rollout
 * (`PaginatedResponseDto` / `PageMetaDto` in basketball-be). `ApiResponse.data` for a
 * list call is `Paginated<T>`, not `T[]` — see `ApiClient.ts` for how each `getAll`
 * exposes this (some flatten it back to `T[]` for existing callers; see their doc comments).
 */
export interface PageMeta {
  page: number;
  limit: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** page/limit/search/sortBy/sortOrder accepted by every paginated GET list endpoint. */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// API Error
export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'STATISTICIAN';
}

/**
 * `POST /auth/change-password`. `oldPassword` is whatever the account currently signs in with —
 * for an account created with an auto-generated password (see `PASSWORD_CHANGE_REQUIRED`
 * handling in `src/auth/gateDecision.ts`), that's the one just used to log in.
 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  user?: AuthUser;
}

// User (admin / users API)
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface UserCreateBody {
  email: string;
  password: string;
  name?: string;
  role: string;
  status?: string;
}

export interface UserUpdateBody {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  password?: string;
}

// Admin (POST/GET/PATCH/DELETE /admin)
export interface Admin {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** The only roles `/admin` manages — its list is filtered to these two. */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

export interface AdminCreateBody {
  email: string;
  /** Optional: left out, the backend generates one, emails it and forces a change on first sign-in. */
  password?: string;
  name?: string;
  role?: AdminRole;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface AdminUpdateBody {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  password?: string;
  role?: AdminRole;
}

/**
 * One entry of `gamesOfficiated` on `GET /statistician/:id`. The backend builds it from the game events
 * the user recorded, so it lists matches they actually scored — one they were only assigned to, with no
 * events yet, is absent — and it carries no tournament, score or status.
 */
export interface GameOfficiated {
  matchId: string;
  homeTeam?: { id?: string; name?: string } | null;
  awayTeam?: { id?: string; name?: string } | null;
  scheduledDate?: string | null;
  venue?: string | null;
}

// Statistician (POST/GET/PATCH/DELETE /statistician)
export interface Statistician {
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  phone?: string;
  country?: string;
  state?: string;
  homeAddress?: string;
  image?: string;
  photo?: string;
  /**
   * `UserProfile` as the backend sends it. There is no first/last name on it — only `fullName`, which
   * the backend builds as "first last" — so the edit form splits that back apart.
   */
  profile?: {
    fullName?: string | null;
    phone?: string | null;
    country?: string | null;
    state?: string | null;
    homeAddress?: string | null;
    bio?: string | null;
    photos?: string[];
    [key: string]: unknown;
  } | null;
  createdAt?: string;
  /** Only on `GET /statistician/:id`, not on the list. */
  gamesOfficiated?: GameOfficiated[];
  [key: string]: unknown;
}

export interface StatisticianCreateBody {
  email: string;
  password?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  phone?: string;
  country?: string;
  state?: string;
  homeAddress?: string;
  photo?: string;
  bio?: string;
  photos?: string[];
  dobDay?: number;
  dobMonth?: number;
  dobYear?: number;
}

export interface StatisticianUpdateBody {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  state?: string;
  homeAddress?: string;
  photo?: string;
}

// Player
export type PlayerPosition =
  | 'POINT_GUARD'
  | 'SHOOTING_GUARD'
  | 'SMALL_FORWARD'
  | 'POWER_FORWARD'
  | 'CENTER';

/** One of a player's team assignments (`PlayerTeamResponseDto`). */
export interface PlayerTeamAssignment {
  id: string;
  teamId: string;
  jerseyNumber?: number | null;
  isCaptain?: boolean | null;
  isActive: boolean;
  joinedAt: string;
  leftAt?: string | null;
  team?: { id: string; name: string; code: string };
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** Optional in `CreatePlayerDto`, so it can come back null. */
  position?: PlayerPosition | string | null;
  height?: string;
  phone?: string;
  dateOfBirth?: string;
  /** The next four are derived from the first *active* assignment, and are `null` when there is none. */
  jerseyNumber?: number | null;
  teamId?: string | null;
  teamName?: string | null;
  isCaptain?: boolean | null;
  /** `PlayerResponseDto.nationality` — was missing; a previous roster page read a non-existent `country` field instead. */
  nationality?: string;
  photo?: string;
  /** Active assignments on the list response; every assignment, newest first, on `GET /players/:id`. */
  playerTeams?: PlayerTeamAssignment[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PlayerCreateStandalone {
  firstName: string;
  lastName: string;
  email?: string;
  /** Optional in `CreatePlayerDto`. */
  position?: PlayerPosition | string;
  height?: string;
  phone?: string;
  dateOfBirth?: string;
  nationality?: string;
  photo?: string;
  confirmDuplicate?: boolean;
}

/**
 * `CreatePlayerForTeamDto`. `jerseyNumber` is required and `position` is optional on the
 * backend — the opposite of what this type said before. Fixed to match the DTO; `phone` was
 * also missing even though the backend accepts it.
 */
export interface PlayerCreateForTeam {
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  email?: string;
  position?: PlayerPosition | string;
  height?: string;
  dateOfBirth?: string;
  phone?: string;
  nationality?: string;
  confirmDuplicate?: boolean;
  photo?: string;
}

export interface PlayerBulkItem {
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  email?: string;
  position?: PlayerPosition | string;
  height?: string;
  nationality?: string;
}

export interface PlayerBulkCreateRequest {
  teamId: string;
  players: PlayerBulkItem[];
}

export interface PlayerUpdateBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  position?: PlayerPosition | string;
  height?: string;
  /** The field is `nationality`. `country` is NOT accepted — the backend's global
   *  `forbidNonWhitelisted` pipe answers 400 "property country should not exist". */
  nationality?: string;
  gender?: string;
  phone?: string;
  dateOfBirth?: string;
  photo?: string;
  /** `teamId` + `jerseyNumber` together re-number the player inside that team. */
  teamId?: string;
  jerseyNumber?: number;
}

export interface PlayerAssignToTeamBody {
  jerseyNumber?: number;
}

export interface PlayerMergeBody {
  duplicatePlayerId: string;
  targetPlayerId: string;
}

export interface PlayerUploadError {
  row: number;
  error: string;
}

export interface PlayerUploadDetail {
  row: number;
  status: string;
  player: string;
  matchScore?: string;
  existingPlayerId?: string;
  /** When backend creates a new player for a flagged row, use as duplicatePlayerId for merge. */
  newPlayerId?: string;
  action?: string;
}

export interface PlayerUploadResult {
  totalProcessed?: number;
  created?: number;
  duplicatesFound?: number;
  errors?: PlayerUploadError[];
  details?: PlayerUploadDetail[];
  /** @deprecated Use created */
  createdCount?: number;
  /** @deprecated Use duplicatesFound */
  duplicatesCount?: number;
  /** @deprecated Use details */
  duplicateMatches?: Array<{ [key: string]: unknown }>;
  [key: string]: unknown;
}

// Team
/**
 * `color`, `country` and `logo` are nullable on the backend (`prisma/schema.prisma`: `color String?`,
 * `country String?`); an earlier version of this type marked `color`/`country` as required and had no
 * `logo` field. That was stale.
 */
export interface Team {
  id: string;
  name: string;
  code: string;
  color?: string;
  logo?: string;
  country?: string;
  state?: string;
  coach?: string;
  assistantCoach?: string;
  [key: string]: unknown;
}

/**
 * `CreateTeamDto`. Only `name` and `code` are required on the backend — confirmed against
 * `create-team.dto.ts` (every other field is `@IsOptional()`). An earlier version of this type
 * marked `color` and `country` as required and had no `logo` field at all; that was stale.
 */
export interface TeamCreate {
  name: string;
  code: string;
  color?: string;
  logo?: string;
  country?: string;
  state?: string;
  coach?: string;
  assistantCoach?: string;
}

export interface TeamUpdate {
  name?: string;
  code?: string;
  color?: string;
  country?: string;
  state?: string;
  coach?: string;
  assistantCoach?: string;
  logo?: string;
}

export interface TeamSetCaptainBody {
  isCaptain: boolean;
}

// Tournament
export type TournamentDivision =
  | 'PREMIER'
  | 'DIVISION_1'
  | 'DIVISION_2'
  | 'DIVISION_3'
  | 'JUNIOR';

export interface Tournament {
  id: string;
  name: string;
  code?: string;
  division: TournamentDivision;
  numberOfGames: number;
  numberOfQuarters: number;
  quarterDuration: number;
  overtimeDuration: number;
  startDate: string;
  endDate: string;
  venue: string;
  flyer?: string;
  crewChief?: string;
  umpire1?: string;
  umpire2?: string;
  commissioner?: string;
  /** Relation counts, present on list responses. */
  _count?: { teams: number; matches: number };
  [key: string]: unknown;
}

export interface TournamentCreate {
  name: string;
  division: TournamentDivision;
  numberOfGames: number;
  numberOfQuarters?: number;
  quarterDuration: number;
  overtimeDuration?: number;
  startDate: string;
  endDate?: string;
  venue?: string;
  flyer?: string;
  crewChief?: string;
  umpire1?: string;
  umpire2?: string;
  commissioner?: string;
}

export interface TournamentUpdate {
  name?: string;
  division?: TournamentDivision;
  numberOfGames?: number;
  numberOfQuarters?: number;
  quarterDuration?: number;
  overtimeDuration?: number;
  startDate?: string;
  endDate?: string;
  venue?: string;
  crewChief?: string;
  umpire1?: string;
  umpire2?: string;
  commissioner?: string;
}

export interface TournamentAddTeamsBody {
  teamIds: string[];
  /** Group ("A"-"D") to put these teams in. Re-adding a team already in the tournament moves it. */
  group?: string;
}

export interface MatchStatRecord {
  id: string;
  playerId: string;
  teamId: string;
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
  minutesPlayed?: number;
  player?: { id: string; firstName: string; lastName: string; position?: string; dateOfBirth?: string; height?: string };
  match?: { id: string; homeTeam?: { id: string; name: string }; awayTeam?: { id: string; name: string } };
}

// Match
export type MatchStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'POSTPONED';

export interface Match {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledDate: string;
  status: MatchStatus;
  venue?: string;
  /** Optional code a scorer can type to open the game. Nothing fills it in today, so the game's id is used instead (see `lib/match-code.ts`). */
  matchKey?: string | null;
  /** Assigned statistician's user id; null/absent = unassigned. */
  statisticianId?: string | null;
  homeScore?: number;
  awayScore?: number;
  quarter1Home?: number;
  quarter1Away?: number;
  quarter2Home?: number;
  quarter2Away?: number;
  quarter3Home?: number;
  quarter3Away?: number;
  quarter4Home?: number;
  quarter4Away?: number;
  totalHome?: number;
  totalAway?: number;
  homeTeam?: Team & { playerTeams?: Array<{ playerId?: string; jerseyNumber?: number; isCaptain?: boolean; player?: { id: string; firstName: string; lastName: string; position?: string; dateOfBirth?: string; height?: string } }> };
  awayTeam?: Team & { playerTeams?: Array<{ playerId?: string; jerseyNumber?: number; isCaptain?: boolean; player?: { id: string; firstName: string; lastName: string; position?: string; dateOfBirth?: string; height?: string } }> };
  tournament?: Tournament;
  stats?: MatchStatRecord[];
  gameSessions?: Array<{ id: string; status: string }>;
  [key: string]: unknown;
}

export interface MatchCreate {
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledDate: string;
  status: MatchStatus;
  venue?: string;
  statisticianId?: string;
}

export interface MatchUpdate {
  status?: MatchStatus;
  venue?: string;
  /** Empty string or null unassigns (backend normalizes "" to null). */
  statisticianId?: string | null;
  scheduledDate?: string;
  quarter1Home?: number;
  quarter1Away?: number;
  quarter2Home?: number;
  quarter2Away?: number;
  quarter3Home?: number;
  quarter3Away?: number;
  quarter4Home?: number;
  quarter4Away?: number;
  overtimeHome?: number;
  overtimeAway?: number;
  homeScore?: number;
  awayScore?: number;
}

// Clients & API keys (Internal Administration — `basketball-be` src/clients, Oct 2026)

/** `ClientResponseDto`. */
export interface Client {
  id: string;
  name: string;
  websiteUrl?: string | null;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `CreateClientDto` — also creates the client's primary CLIENT user, whom the server tries to email a temporary password (delivery is not confirmed, Gap 49), and who must change it on first login. */
export interface ClientCreate {
  name: string;
  websiteUrl?: string;
  logo?: string;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
}

/** `ClientApiKeyResponseDto` as listed. The secret is never returned after creation. */
export interface ClientApiKey {
  id: string;
  name: string;
  clientId: string;
  createdAt: string;
  lastUsed?: string | null;
}

/** Returned once by `POST /clients/api-keys`. `apiKey` is the only copy that will ever exist. */
export interface ClientApiKeyCreated extends ClientApiKey {
  apiKey: string;
}

