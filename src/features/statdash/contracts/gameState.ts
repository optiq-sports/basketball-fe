export interface StatDashGameStateContract {
  sessionId: string;
  matchId: string;
  version: number;
  quarter: number;
  clockSecondsRemaining: number;
  isRunning: boolean;
  homeScore: number;
  awayScore: number;
  homeOnLeft: boolean;
  homeAttacksLeft: boolean;
  possessionTeamId: string | null;
  jumpBallWinnerTeamId: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export function isGameStateEnded(state: StatDashGameStateContract): boolean {
  return state.endedAt !== null;
}
