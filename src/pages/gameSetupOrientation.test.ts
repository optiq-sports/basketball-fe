import { beforeEach, describe, expect, it } from 'vitest';
import {
  GAME_SETUP_ORIENTATION_KEY,
  readGameSetupOrientation,
  readGameSetupOrientationForSession,
  writeGameSetupOrientation,
} from './gameSetupOrientation';

describe('game setup orientation storage', () => {
  beforeEach(() => {
    sessionStorage.removeItem(GAME_SETUP_ORIENTATION_KEY);
  });

  it('returns null for a session when nothing has been saved', () => {
    expect(readGameSetupOrientationForSession('s1')).toBeNull();
  });

  it('returns what was saved for the same session', () => {
    writeGameSetupOrientation({ homeOnLeft: false, homeAttacksLeft: true }, 's1');
    expect(readGameSetupOrientationForSession('s1')).toEqual({ homeOnLeft: false, homeAttacksLeft: true });
  });

  it("never applies another game's saved sides to this session", () => {
    writeGameSetupOrientation({ homeOnLeft: false, homeAttacksLeft: false }, 'other-game');
    expect(readGameSetupOrientationForSession('s1')).toBeNull();
  });

  it('treats an entry saved before sessions were recorded as belonging to the current session', () => {
    sessionStorage.setItem(
      GAME_SETUP_ORIENTATION_KEY,
      JSON.stringify({ homeOnLeft: false, homeAttacksLeft: true }),
    );
    expect(readGameSetupOrientationForSession('s1')).toEqual({ homeOnLeft: false, homeAttacksLeft: true });
  });

  it('keeps the plain reader working for pages that only need the value (JumpBall)', () => {
    expect(readGameSetupOrientation()).toEqual({ homeOnLeft: true, homeAttacksLeft: true });
    writeGameSetupOrientation({ homeOnLeft: false, homeAttacksLeft: false }, 's1');
    expect(readGameSetupOrientation()).toEqual({ homeOnLeft: false, homeAttacksLeft: false });
  });
});
