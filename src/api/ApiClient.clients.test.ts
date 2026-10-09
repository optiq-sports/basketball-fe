import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Paths, methods and bodies must match the backend's `/clients` routes exactly (Swagger "Clients (Internal Administration)"). */
function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('ApiClient.clients (Internal Administration)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let apiClient: typeof import('./ApiClient').apiClient;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    ({ apiClient } = await import('./ApiClient'));
  });

  afterEach(() => vi.unstubAllGlobals());

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
    return { url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body as string) : undefined };
  };

  it('create client posts the whole body to /clients', async () => {
    const body = { name: 'Acme', userEmail: 'a@b.test', userFirstName: 'A', userLastName: 'B' };
    await apiClient.clients.create(body);
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients$/), method: 'POST', body });
  });

  it('assign user posts { userId } to /clients/:clientId/users', async () => {
    await apiClient.clients.assignUser('c 1', 'u9');
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/c%201\/users$/), method: 'POST', body: { userId: 'u9' } });
  });

  it('list keys GETs /clients/:clientId/api-keys', async () => {
    await apiClient.clients.listApiKeys('c1');
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/c1\/api-keys$/), method: 'GET' });
  });

  it('create key posts { clientId, name } to /clients/api-keys', async () => {
    await apiClient.clients.createApiKey('c1', 'Scoreboard');
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/api-keys$/), method: 'POST', body: { clientId: 'c1', name: 'Scoreboard' } });
  });

  it('revoke key DELETEs /clients/api-keys/:id', async () => {
    await apiClient.clients.revokeApiKey('k1');
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/api-keys\/k1$/), method: 'DELETE' });
  });

  it('list clients passes paging and search through to GET /clients', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [], meta: { page: 2, limit: 5, itemCount: 0, pageCount: 0, hasPreviousPage: true, hasNextPage: false } } }));
    await apiClient.clients.getPage({ page: 2, limit: 5, search: 'acme' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/clients\?/);
    expect(url).toContain('page=2');
    expect(url).toContain('search=acme');
  });

  it('lists the signed-in client user’s own keys from /clients/me/api-keys', async () => {
    await apiClient.clients.listMyApiKeys();
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/me\/api-keys$/), method: 'GET' });
  });

  it('creates an own key with just a name', async () => {
    await apiClient.clients.createMyApiKey('Club website');
    expect(lastCall()).toMatchObject({ url: expect.stringMatching(/\/clients\/me\/api-keys$/), method: 'POST', body: { name: 'Club website' } });
  });
});
