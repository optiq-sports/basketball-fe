const STARTERS_REQUIRED = 5;

export type FirstFiveGateResult = {
  ready: boolean;
  /** Short bullets for the UI (plain text; caller can emphasize numbers). */
  issues: { id: string; text: string }[];
};

/**
 * Both teams need ≥5 Playing and exactly 5 First-5 selections before Continue / Apply.
 */
export function computeFirstFiveGate(
  homePlaying: Set<number>,
  homeStarters: Set<number>,
  awayPlaying: Set<number>,
  awayStarters: Set<number>
): FirstFiveGateResult {
  const issues: { id: string; text: string }[] = [];

  if (homePlaying.size < STARTERS_REQUIRED) {
    issues.push({
      id: 'home-playing',
      text: `Home: mark at least ${STARTERS_REQUIRED} players as Playing before you can lock in five starters.`,
    });
  } else if (homeStarters.size < STARTERS_REQUIRED) {
    issues.push({
      id: 'home-starters',
      text: `Home: select ${STARTERS_REQUIRED - homeStarters.size} more in First 5 (${homeStarters.size} of ${STARTERS_REQUIRED} so far).`,
    });
  }

  if (awayPlaying.size < STARTERS_REQUIRED) {
    issues.push({
      id: 'away-playing',
      text: `Away: mark at least ${STARTERS_REQUIRED} players as Playing before you can lock in five starters.`,
    });
  } else if (awayStarters.size < STARTERS_REQUIRED) {
    issues.push({
      id: 'away-starters',
      text: `Away: select ${STARTERS_REQUIRED - awayStarters.size} more in First 5 (${awayStarters.size} of ${STARTERS_REQUIRED} so far).`,
    });
  }

  return { ready: issues.length === 0, issues };
}
