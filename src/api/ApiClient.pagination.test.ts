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

  describe('teams: GET /teams?tournamentId= 400s on the backend (cuid id, @IsUUID() validator)', () => {
    it('getAll() with no tournamentId pages /teams normally', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(envelope([{ id: 'team-1' }], 1, 100, 1)));
      const res = await apiClient.teams.getAll();
      expect(res.data).toEqual([{ id: 'team-1' }]);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/teams?');
      expect(url).not.toContain('tournamentId');
    });

    it('getAll({ tournamentId }) reads the tournament\'s own nested teams instead of filtering /teams', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            id: 'tourn-1',
            teams: [{ team: { id: 'team-1', name: 'A' } }, { team: { id: 'team-2', name: 'B' } }],
          },
          timestamp: new Date().toISOString(),
        }),
      );
      const res = await apiClient.teams.getAll({ tournamentId: 'tourn-1' });
      expect(res.ok).toBe(true);
      expect(res.data).toEqual([{ id: 'team-1', name: 'A' }, { id: 'team-2', name: 'B' }]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/tournaments/tourn-1');
      expect(url).not.toContain('/teams?');
    });

    it('getAll({ tournamentId }) on a tournament with no teams yet returns an empty list, not a crash', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { id: 'tourn-1', teams: [] }, timestamp: new Date().toISOString() }),
      );
      const res = await apiClient.teams.getAll({ tournamentId: 'tourn-1' });
      expect(res.ok).toBe(true);
      expect(res.data).toEqual([]);
    });
  });
});
