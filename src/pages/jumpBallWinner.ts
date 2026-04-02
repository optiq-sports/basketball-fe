export const JUMP_BALL_WINNER_KEY = 'statdash_jump_ball_winner';

export type JumpBallWinner = 'left' | 'right';

export function readJumpBallWinner(): JumpBallWinner | null {
  try {
    const raw = sessionStorage.getItem(JUMP_BALL_WINNER_KEY);
    if (!raw) return null;
    if (raw !== 'left' && raw !== 'right') return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeJumpBallWinner(value: JumpBallWinner): void {
  try {
    sessionStorage.setItem(JUMP_BALL_WINNER_KEY, value);
  } catch {
    // ignore
  }
}

export function clearJumpBallWinner(): void {
  try {
    sessionStorage.removeItem(JUMP_BALL_WINNER_KEY);
  } catch {
    // ignore
  }
}

