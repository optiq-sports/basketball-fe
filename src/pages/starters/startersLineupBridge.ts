import type { OnCourtSlots, TeamLineup } from '../statDash/substitutionLineupUtils';
import { fullRoster } from '../statDash/substitutionLineupUtils';

/** Starters UI rows map to jerseys 1–12 (row id = jersey − 1). */
export const STARTER_ROW_COUNT = 12;

export function teamLineupToStartersSets(lineup: TeamLineup): { playing: Set<number>; starters: Set<number> } {
  const playing = new Set<number>();
  const starters = new Set<number>();
  for (const j of fullRoster(lineup)) {
    if (j >= 1 && j <= STARTER_ROW_COUNT) playing.add(j - 1);
  }
  for (const j of lineup.onCourt) {
    if (j !== null && j >= 1 && j <= STARTER_ROW_COUNT) starters.add(j - 1);
  }
  return { playing, starters };
}

/** Mirrors Starters page ordering: mock player order, first five from starter set. */
export function startersSetsToTeamLineup(playing: Set<number>, starters: Set<number>): TeamLineup {
  const playingPlayers = Array.from({ length: STARTER_ROW_COUNT }, (_, i) => ({
    id: i,
    jersey: i + 1,
  })).filter((p) => playing.has(p.id));
  const selectedFirstFive = playingPlayers.filter((p) => starters.has(p.id)).slice(0, 5);
  const starterJerseys = new Set(selectedFirstFive.map((p) => p.jersey));
  const onCourt: OnCourtSlots = [null, null, null, null, null];
  selectedFirstFive.forEach((p, i) => {
    onCourt[i] = p.jersey;
  });
  const bench = playingPlayers.filter((p) => !starterJerseys.has(p.jersey)).map((p) => p.jersey);
  return { onCourt, bench };
}

/**
 * Like startersSetsToTeamLineup but uses the actual player roster so real jersey numbers
 * (not hardcoded 1-N) end up in the lineup.
 */
export function startersSetsToTeamLineupWithPlayers(
  indexedPlayers: { id: number; jersey: number }[],
  playing: Set<number>,
  starters: Set<number>,
): TeamLineup {
  const playingPlayers = indexedPlayers.filter((p) => playing.has(p.id));
  const selectedFirstFive = playingPlayers.filter((p) => starters.has(p.id)).slice(0, 5);
  const starterJerseys = new Set(selectedFirstFive.map((p) => p.jersey));
  const onCourt: OnCourtSlots = [null, null, null, null, null];
  selectedFirstFive.forEach((p, i) => { onCourt[i] = p.jersey; });
  const bench = playingPlayers.filter((p) => !starterJerseys.has(p.jersey)).map((p) => p.jersey);
  return { onCourt, bench };
}

/** Keep jerseys not represented in the 1–12 Starters grid (e.g. #15) on the bench. */
export function mergeLineupPreserveExtraJerseys(baseline: TeamLineup, fromUi: TeamLineup): TeamLineup {
  const ui = new Set(fullRoster(fromUi));
  const extra = fullRoster(baseline).filter((j) => !ui.has(j));
  return {
    onCourt: fromUi.onCourt,
    bench: [...fromUi.bench, ...extra].sort((a, b) => a - b),
  };
}
