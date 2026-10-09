import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Every list endpoint became paginated server-side (Sep 2026 backend pagination rollout —
 * `{ items, meta }`, max 100/page). `getAll()` on each namespace still has to hand back the
 * *complete* list the way it always did (callers search/sort/count client-side), so it walks
 * every page under the hood. These tests exercise that against the real `fetch` call, not a
 * mocked ApiClient, so a change to the query string or page-walking logic actually gets caught.
 */

const envelope = (items: unknown[], page: number, limit: number, itemCount: number) => ({
  success: true,
  data: {
    items,
    meta: {
      page,
      limit,
      itemCount,
      pageCount: Math.ceil(itemCount / limit),
      hasPreviousPage: page > 1,
      hasNextPage: page * limit < itemCount,
    },
  },
  timestamp: new Date().toISOString(),
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('ApiClient pagination', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let apiClient: typeof import('./ApiClient').apiClient;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    ({ apiClient } = await import('./ApiClient'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('players.getAll walks every page and concatenates items, in one call per page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(envelope([{ id: 'p1' }, { id: 'p2' }], 1, 2, 3)))
      .mockResolvedValueOnce(jsonResponse(envelope([{ id: 'p3' }], 2, 2, 3)));

    const res = await apiClient.players.getAll({ teamId: 'team-1' });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(firstUrl).toContain('/players?');
    expect(firstUrl).toContain('teamId=team-1');
    expect(firstUrl).toContain('page=1');
    expect(firstUrl).toContain('limit=100');
    expect(secondUrl).toContain('page=2');
  });

  it('stops after one page when the server says there is no next page', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([{ id: 't1' }], 1, 100, 1)));
    const res = await apiClient.tournaments.getAll();
    expect(res.data).toEqual([{ id: 't1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tournaments.getPage sends page/limit/search/sortBy/sortOrder as query params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(envelope([], 2, 5, 0)));
    await apiClient.tournaments.getPage({ page: 2, limit: 5, search: 'summer', sortBy: 'name', sortOrder: 'asc' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=5');
    expect(url).toContain('search=summer');
    expect(url).toContain('sortBy=name');
    expect(url).toContain('sortOrder=asc');
  });

  describe('teams: tournamentId filter is server-side again (backend validator fixed, 4a2d87c)', () => {
    it('getAll() with no tournamentId pages /teams normally', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope([{ id: 'team-1' }], 1, 100, 1)));
      const res = await apiClient.teams.getAll();
      expect(res.data).toEqual([{ id: 'team-1' }]);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/teams?');
      expect(url).not.toContain('tournamentId');
    });

    it('getAll({ tournamentId }) sends the filter to GET /teams and walks its pages', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(envelope([{ id: 'team-1' }], 1, 1, 2)))
        .mockResolvedValueOnce(jsonResponse(envelope([{ id: 'team-2' }], 2, 1, 2)));
      const res = await apiClient.teams.getAll({ tournamentId: 'cmuidecfq0001sba6ac62n35q' });
      expect(res.data).toEqual([{ id: 'team-1' }, { id: 'team-2' }]);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/teams?');
      expect(url).toContain('tournamentId=cmuidecfq0001sba6ac62n35q');
    });

    it('getAll({ tournamentId }) for a tournament with no teams returns an empty list', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope([], 1, 100, 0)));
      const res = await apiClient.teams.getAll({ tournamentId: 'tourn-1' });
      expect(res.ok).toBe(true);
      expect(res.data).toEqual([]);
    });
  });
});
