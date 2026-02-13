// API Response Types
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
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

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  access_token: string;
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
  name?: string;
  role?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AdminCreateBody {
  email: string;
  password: string;
  name?: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'STATISTICIAN';
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface AdminUpdateBody {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
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
  bio?: string;
  photos?: string[];
  dobDay?: number;
  dobMonth?: number;
  dobYear?: number;
}

export interface StatisticianUpdateBody {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  state?: string;
  homeAddress?: string;
}

// Player
export type PlayerPosition =
  | 'POINT_GUARD'
  | 'SHOOTING_GUARD'
  | 'SMALL_FORWARD'
  | 'POWER_FORWARD'
  | 'CENTER';

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  position: PlayerPosition | string;
  height?: string;
  phone?: string;
  dateOfBirth?: string;
  jerseyNumber?: number;
  teamId?: string;
  [key: string]: unknown;
}

export interface PlayerCreateStandalone {
  firstName: string;
  lastName: string;
  email?: string;
  position: PlayerPosition | string;
  height?: string;
  phone?: string;
  dateOfBirth?: string;
  nationality?: string;
  confirmDuplicate?: boolean;
}

export interface PlayerCreateForTeam {
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  email?: string;
  position: PlayerPosition | string;
  height?: string;
  dateOfBirth?: string;
  nationality?: string;
  confirmDuplicate?: boolean;
}

export interface PlayerBulkItem {
  firstName: string;
  lastName: string;
  jerseyNumber?: number;
  email?: string;
  position: PlayerPosition | string;
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
  phone?: string;
  dateOfBirth?: string;
}

export interface PlayerAssignToTeamBody {
  jerseyNumber?: number;
}

export interface PlayerMergeBody {
  duplicatePlayerId: string;
  targetPlayerId: string;
}

export interface PlayerUploadResult {
  createdCount?: number;
  duplicatesCount?: number;
  duplicateMatches?: Array<{ [key: string]: unknown }>;
  [key: string]: unknown;
}

// Team
export interface Team {
  id: string;
  name: string;
  code: string;
  color: string;
  country: string;
  state?: string;
  coach?: string;
  assistantCoach?: string;
  [key: string]: unknown;
}

export interface TeamCreate {
  name: string;
  code: string;
  color: string;
  country: string;
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
}

// Tournament
export type TournamentDivision = 'PREMIER' | string;

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
  crewChief?: string;
  umpire1?: string;
  umpire2?: string;
  commissioner?: string;
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
  [key: string]: unknown;
}

export interface MatchCreate {
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledDate: string;
  status: MatchStatus;
  venue?: string;
}

export interface MatchUpdate {
  status?: MatchStatus;
  venue?: string;
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
