import type { TimelineEvent } from '../services/statdash/types';

export interface PeriodScore { period: number; home: number; away: number }

const byOrder = (a: TimelineEvent, b: TimelineEvent) => a.sequence - b.sequence;

/** A period's label: Q1–Q4, then OT, OT2 … */
export const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : p === 5 ? 'OT' : `OT${p - 4}`);

/** Points each team scored in each period, from the running score at the end of it. */
export function periodScores(events: TimelineEvent[]): PeriodScore[] {
  const sorted = [...events].sort(byOrder);
  const last = new Map<number, { home: number; away: number }>();
  for (const e of sorted) if (e.period != null) last.set(e.period, { home: e.homeScore, away: e.awayScore });
  const out: PeriodScore[] = [];
  let prevHome = 0;
  let prevAway = 0;
  for (const period of [...last.keys()].sort((a, b) => a - b)) {
    const end = last.get(period)!;
    out.push({ period, home: end.home - prevHome, away: end.away - prevAway });
    prevHome = end.home;
    prevAway = end.away;
  }
  return out;
}

export interface LeadPoint {
  /** Home minus away after this score; positive means home is ahead. */
  margin: number;
  period: number;
  /** Seconds since tip-off. */
  elapsed: number;
}

export interface LeadSummary {
  series: LeadPoint[];
  biggestLead: { home: number; away: number };
  /** Longest unanswered scoring run: points, and the opponent's 0. */
  biggestRun: { home: number; away: number };
  /** Seconds each team was in front. */
  timeLeading: { home: number; away: number };
  leadChanges: number;
  timesTied: number;
}

/**
 * The score margin as it moved through the game, and what it says: biggest lead, longest run, time in
 * front, lead changes and times tied. Built only from scoring plays. `quarterSeconds` and `overtimeSeconds`
 * turn a period and clock into elapsed time.
 */
export function leadSummary(events: TimelineEvent[], quarterSeconds = 600, overtimeSeconds = 300): LeadSummary {
  const sorted = [...events].sort(byOrder);
  const lengthOf = (p: number) => (p <= 4 ? quarterSeconds : overtimeSeconds);
  const startOf = (p: number) => {
    let t = 0;
    for (let i = 1; i < p; i++) t += lengthOf(i);
    return t;
  };

  const series: LeadPoint[] = [];
  const out: LeadSummary = { series, biggestLead: { home: 0, away: 0 }, biggestRun: { home: 0, away: 0 }, timeLeading: { home: 0, away: 0 }, leadChanges: 0, timesTied: 0 };
  let prevHome = 0;
  let prevAway = 0;
  let currentLeader: 'home' | 'away' | null = null;
  let lastLeader: 'home' | 'away' | null = null;
  let prevElapsed = 0;
  let runTeam: 'home' | 'away' | null = null;
  let runPoints = 0;

  for (const e of sorted) {
    const dh = e.homeScore - prevHome;
    const da = e.awayScore - prevAway;
    prevHome = e.homeScore;
    prevAway = e.awayScore;
    if (dh <= 0 && da <= 0) continue;
    const period = e.period ?? 1;
    const elapsed = startOf(period) + (e.clockSecondsRemaining == null ? 0 : lengthOf(period) - e.clockSecondsRemaining);

    // Time in front up to this play belongs to whoever led before it.
    if (currentLeader) out.timeLeading[currentLeader] += Math.max(0, elapsed - prevElapsed);
    prevElapsed = elapsed;

    const margin = e.homeScore - e.awayScore;
    series.push({ margin, period, elapsed });
    if (margin > 0) out.biggestLead.home = Math.max(out.biggestLead.home, margin);
    if (margin < 0) out.biggestLead.away = Math.max(out.biggestLead.away, -margin);

    const leader = margin > 0 ? 'home' : margin < 0 ? 'away' : null;
    // A lead that passes through a tie still changed hands.
    if (leader && lastLeader && leader !== lastLeader) out.leadChanges += 1;
    if (margin === 0) out.timesTied += 1;
    currentLeader = leader;
    if (leader) lastLeader = leader;

    const scorer = dh > 0 ? 'home' : 'away';
    if (runTeam === scorer) runPoints += Math.max(dh, da);
    else {
      runTeam = scorer;
      runPoints = Math.max(dh, da);
    }
    out.biggestRun[scorer] = Math.max(out.biggestRun[scorer], runPoints);
  }
  return out;
}

/** `m:ss` for a count of seconds. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
