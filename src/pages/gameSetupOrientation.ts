export const GAME_SETUP_ORIENTATION_KEY = 'statdash_game_orientation';

export type GameSetupOrientation = {
  homeOnLeft: boolean;
  homeAttacksLeft: boolean;
};

export function readGameSetupOrientation(): GameSetupOrientation {
  try {
    const raw = sessionStorage.getItem(GAME_SETUP_ORIENTATION_KEY);
    if (!raw) return { homeOnLeft: true, homeAttacksLeft: true };
    const parsed = JSON.parse(raw) as Partial<GameSetupOrientation>;
    return {
      homeOnLeft: parsed.homeOnLeft !== false,
      homeAttacksLeft: parsed.homeAttacksLeft !== false,
    };
  } catch {
    return { homeOnLeft: true, homeAttacksLeft: true };
  }
}

/** Pass sessionId so a value saved for one game can never be mistaken for another game's. */
export function writeGameSetupOrientation(value: GameSetupOrientation, sessionId?: string): void {
  sessionStorage.setItem(GAME_SETUP_ORIENTATION_KEY, JSON.stringify({ ...value, sessionId }));
}

/**
 * The orientation saved in this tab for this specific session, or null if there isn't one
 * (nothing saved, or it belongs to a different session). Entries written before sessions were
 * recorded carry no sessionId and are treated as belonging to the current session.
 */
export function readGameSetupOrientationForSession(sessionId: string): GameSetupOrientation | null {
  try {
    const raw = sessionStorage.getItem(GAME_SETUP_ORIENTATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSetupOrientation> & { sessionId?: string };
    if (parsed.sessionId && parsed.sessionId !== sessionId) return null;
    return {
      homeOnLeft: parsed.homeOnLeft !== false,
      homeAttacksLeft: parsed.homeAttacksLeft !== false,
    };
  } catch {
    return null;
  }
}
