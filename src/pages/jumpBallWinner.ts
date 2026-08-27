export const JUMP_BALL_WINNER_KEY = 'statdash_jump_ball_winner_team_id';

/**
 * Holds the real team ID (not just a court side) so StatDash can send the
 * pre-game jump-ball result to the backend via the same `jump_ball` command
 * the in-game re-jump-ball flow already uses — see StatDash.tsx bootstrap
 * effect and docs/BUGS.md / docs/FIXES.md for the "jump ball pick was thrown
 * away" bug this replaced.
 */
export function readJumpBallWinnerTeamId(): string | null {
  try {
    return sessionStorage.getItem(JUMP_BALL_WINNER_KEY);
  } catch {
    return null;
  }
}

export function writeJumpBallWinnerTeamId(teamId: string): void {
  try {
    sessionStorage.setItem(JUMP_BALL_WINNER_KEY, teamId);
  } catch {
    // ignore
  }
}

export function clearJumpBallWinnerTeamId(): void {
  try {
    sessionStorage.removeItem(JUMP_BALL_WINNER_KEY);
  } catch {
    // ignore
  }
}
