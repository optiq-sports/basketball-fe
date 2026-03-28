/** Five on-court slots; `null` = empty while editing substitutions. */
export type OnCourtSlots = [number | null, number | null, number | null, number | null, number | null];

export type TeamLineup = {
  onCourt: OnCourtSlots;
  bench: number[];
};

export const LINEUP_SLOTS = 5 as const;

export const DEFAULT_TEAM_LINEUP: TeamLineup = {
  onCourt: [1, 2, 3, 4, 5],
  bench: [15, 10, 16, 11, 8, 9, 30, 23],
};

export function cloneLineup(lineup: TeamLineup): TeamLineup {
  return {
    onCourt: [...lineup.onCourt] as OnCourtSlots,
    bench: [...lineup.bench],
  };
}

export function fullRoster(lineup: TeamLineup): number[] {
  const on = lineup.onCourt.filter((j): j is number => j !== null);
  return [...new Set([...on, ...lineup.bench])].sort((a, b) => a - b);
}

export function compactOnCourt(lineup: TeamLineup): number[] {
  return lineup.onCourt.filter((j): j is number => j !== null);
}

export function lineupIsComplete(lineup: TeamLineup): boolean {
  return lineup.onCourt.every((j) => j !== null);
}

/** Move jersey from on-court slot to bench (append). */
export function moveSlotToBench(lineup: TeamLineup, slotIndex: number): TeamLineup {
  if (slotIndex < 0 || slotIndex >= LINEUP_SLOTS) return lineup;
  const j = lineup.onCourt[slotIndex];
  if (j === null) return lineup;
  const onCourt = [...lineup.onCourt] as OnCourtSlots;
  onCourt[slotIndex] = null;
  return { onCourt, bench: [...lineup.bench, j] };
}

/** Move jersey from bench into first empty on-court slot. */
export function moveBenchToFirstEmptySlot(
  lineup: TeamLineup,
  benchIndex: number
): TeamLineup {
  if (benchIndex < 0 || benchIndex >= lineup.bench.length) return lineup;
  const emptyIdx = lineup.onCourt.findIndex((x) => x === null);
  if (emptyIdx === -1) return lineup;
  const j = lineup.bench[benchIndex];
  const onCourt = [...lineup.onCourt] as OnCourtSlots;
  onCourt[emptyIdx] = j;
  const bench = lineup.bench.filter((_, i) => i !== benchIndex);
  return { onCourt, bench };
}

export function diffLineupOnCourt(before: TeamLineup, after: TeamLineup): {
  out: number[];
  in: number[];
} {
  const beforeOn = new Set(
    before.onCourt.filter((j): j is number => j !== null)
  );
  const afterOn = new Set(after.onCourt.filter((j): j is number => j !== null));
  const out = [...beforeOn].filter((j) => !afterOn.has(j)).sort((a, b) => a - b);
  const inn = [...afterOn].filter((j) => !beforeOn.has(j)).sort((a, b) => a - b);
  return { out, in: inn };
}

export function formatSubstitutionDiff(
  teamLabel: string,
  diff: { out: number[]; in: number[] }
): string {
  const parts: string[] = [];
  if (diff.out.length) parts.push(`out ${diff.out.map((n) => `#${n}`).join(', ')}`);
  if (diff.in.length) parts.push(`in ${diff.in.map((n) => `#${n}`).join(', ')}`);
  if (parts.length === 0) return `${teamLabel}: no change`;
  return `${teamLabel}: ${parts.join('; ')}`;
}
