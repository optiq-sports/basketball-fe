import type { TeamLineup } from '../../pages/statDash/substitutionLineupUtils';

const SESSION_ID_KEY = 'statdash_session_id';
const MATCH_ID_KEY = 'statdash_match_id';
const VERSION_KEY = 'statdash_expected_version';
const HOME_TEAM_ID_KEY = 'statdash_home_team_id';
const AWAY_TEAM_ID_KEY = 'statdash_away_team_id';

export interface StoredSessionContext {
  sessionId: string;
  matchId: string;
  homeTeamId?: string;
  awayTeamId?: string;
}

export function writeStoredSessionContext(context: StoredSessionContext): void {
  sessionStorage.setItem(SESSION_ID_KEY, context.sessionId);
  sessionStorage.setItem(MATCH_ID_KEY, context.matchId);
  if (context.homeTeamId) sessionStorage.setItem(HOME_TEAM_ID_KEY, context.homeTeamId);
  if (context.awayTeamId) sessionStorage.setItem(AWAY_TEAM_ID_KEY, context.awayTeamId);
}

export function readStoredSessionContext(): StoredSessionContext | null {
  const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  const matchId = sessionStorage.getItem(MATCH_ID_KEY);
  if (!sessionId || !matchId) {
    return null;
  }
  return {
    sessionId,
    matchId,
    homeTeamId: sessionStorage.getItem(HOME_TEAM_ID_KEY) ?? undefined,
    awayTeamId: sessionStorage.getItem(AWAY_TEAM_ID_KEY) ?? undefined,
  };
}

export function writeStoredExpectedVersion(version: number): void {
  sessionStorage.setItem(VERSION_KEY, String(version));
}

export function readStoredExpectedVersion(): number {
  const raw = sessionStorage.getItem(VERSION_KEY);
  const parsed = raw == null ? Number.NaN : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

const LINEUPS_KEY = 'statdash_lineups';

export function writeStoredLineups(lineups: { home: TeamLineup; away: TeamLineup }): void {
  sessionStorage.setItem(LINEUPS_KEY, JSON.stringify(lineups));
}

export function readStoredLineups(): { home: TeamLineup; away: TeamLineup } | null {
  try {
    const raw = sessionStorage.getItem(LINEUPS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { home: TeamLineup; away: TeamLineup };
  } catch {
    return null;
  }
}
