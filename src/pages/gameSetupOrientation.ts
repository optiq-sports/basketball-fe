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

export function writeGameSetupOrientation(value: GameSetupOrientation): void {
  sessionStorage.setItem(GAME_SETUP_ORIENTATION_KEY, JSON.stringify(value));
}
