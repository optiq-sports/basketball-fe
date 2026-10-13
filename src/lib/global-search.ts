import { normalizeName } from './text';

export type SearchKind = 'tournament' | 'team' | 'player';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchSources {
  tournaments: Array<{ id: string; name: string; venue?: string | null }>;
  teams: Array<{ id: string; name: string; code?: string | null; country?: string | null }>;
  players: Array<{ id: string; firstName: string; lastName: string; teamName?: string | null; jerseyNumber?: number | null }>;
}

export const SEARCH_LIMIT = 5;

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Finds tournaments, teams and players by name for the top-bar search. The backend accepts `search` on
 * these lists and ignores it (Gaps 33, 39), so this filters the full lists in the browser. Names starting
 * with the query come before names that merely contain it.
 */
export function searchEverything(query: string, src: SearchSources, limit = SEARCH_LIMIT): Record<SearchKind, SearchHit[]> {
  const needle = fold(query.trim());
  const empty = { tournament: [], team: [], player: [] } as Record<SearchKind, SearchHit[]>;
  if (!needle) return empty;

  const rank = (haystacks: Array<string | null | undefined>): number => {
    let best = Infinity;
    for (const h of haystacks) {
      if (!h) continue;
      const f = fold(h);
      const i = f.indexOf(needle);
      if (i === 0) best = Math.min(best, 0);
      else if (i > 0) best = Math.min(best, f[i - 1] === ' ' ? 1 : 2);
    }
    return best;
  };
  const top = <T,>(items: T[], score: (t: T) => number, make: (t: T) => SearchHit): SearchHit[] =>
    items
      .map((t) => ({ t, s: score(t) }))
      .filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s || make(a.t).title.localeCompare(make(b.t).title))
      .slice(0, limit)
      .map((x) => make(x.t));

  return {
    tournament: top(src.tournaments, (t) => rank([t.name, t.venue]), (t) => ({
      kind: 'tournament', id: t.id, title: normalizeName(t.name), subtitle: t.venue ?? 'Tournament', href: `/tournaments/${t.id}`,
    })),
    team: top(src.teams, (t) => rank([t.name, t.code]), (t) => ({
      kind: 'team', id: t.id, title: normalizeName(t.name), subtitle: [t.code, t.country].filter(Boolean).join(' · ') || 'Team', href: `/teams-management/${t.id}`,
    })),
    player: top(src.players, (p) => Math.min(rank([`${p.firstName} ${p.lastName}`, p.lastName]), rank([p.teamName]) + 3), (p) => ({
      kind: 'player', id: p.id, title: `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim(),
      subtitle: [p.jerseyNumber != null ? `#${p.jerseyNumber}` : null, p.teamName].filter(Boolean).join(' · ') || 'Player', href: `/players-management/${p.id}`,
    })),
  };
}
