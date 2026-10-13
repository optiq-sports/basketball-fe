import { describe, expect, it } from 'vitest';
import { searchEverything, type SearchSources } from './global-search';

const src: SearchSources = {
  tournaments: [{ id: 't1', name: 'Summer Cup', venue: 'Main Arena' }, { id: 't2', name: 'Winter League' }],
  teams: [{ id: 'k1', name: 'Marktown Flyers', code: 'MTF', country: 'Nigeria' }, { id: 'k2', name: 'Fresh Stars', code: 'FRS' }],
  players: [
    { id: 'p1', firstName: 'Ana', lastName: 'Guard', teamName: 'Marktown Flyers', jerseyNumber: 7 },
    { id: 'p2', firstName: 'Mark', lastName: 'Wing' },
    { id: 'p3', firstName: 'Zoë', lastName: 'Marks' },
  ],
};

describe('searchEverything', () => {
  it('returns nothing for a blank query', () => {
    const r = searchEverything('  ', src);
    expect(r.tournament.length + r.team.length + r.player.length).toBe(0);
  });

  it('finds each kind by name and links to its page', () => {
    const r = searchEverything('summer', src);
    expect(r.tournament[0]).toMatchObject({ id: 't1', href: '/tournaments/t1', subtitle: 'Main Arena' });
    expect(searchEverything('fresh', src).team[0].href).toBe('/teams-management/k2');
    expect(searchEverything('guard', src).player[0].href).toBe('/players-management/p1');
  });

  it('matches a team by its code', () => {
    expect(searchEverything('frs', src).team.map((t) => t.id)).toEqual(['k2']);
  });

  it('puts names that start with the query ahead of names that only contain it', () => {
    const names = searchEverything('mark', src).player.map((p) => p.title);
    expect(names[0]).toBe('Mark Wing');
    expect(names).toContain('Ana Guard');
  });

  it('ignores case and accents', () => {
    expect(searchEverything('ZOE', src).player.map((p) => p.id)).toEqual(['p3']);
  });

  it('shows a player’s number and team as the subtitle', () => {
    expect(searchEverything('ana', src).player[0].subtitle).toBe('#7 · Marktown Flyers');
  });

  it('caps each group', () => {
    const many = { ...src, teams: Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, name: `Team ${i}` })) };
    expect(searchEverything('team', many).team).toHaveLength(5);
  });
});
