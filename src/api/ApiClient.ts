import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Admin,
  AdminCreateBody,
  AdminUpdateBody,
  Statistician,
  StatisticianCreateBody,
  StatisticianUpdateBody,
  Player,
  PlayerCreateStandalone,
  PlayerCreateForTeam,
  PlayerBulkCreateRequest,
  PlayerUpdateBody,
  PlayerAssignToTeamBody,
  PlayerMergeBody,
  PlayerUploadResult,
  Team,
  TeamCreate,
  TeamUpdate,
  TeamSetCaptainBody,
  Tournament,
  TournamentCreate,
  TournamentUpdate,
  TournamentAddTeamsBody,
  Match,
  MatchCreate,
  MatchUpdate,
  Paginated,
  PaginationParams,
  ChangePasswordRequest,
} from '../types/api';
import { ApiError } from '../types/api';
import { API_BASE } from '../config';
import { broadcastAuthSessionExpired, refreshAccessToken } from '../auth/authSession';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function isPublicAuthEndpoint(endpoint: string): boolean {
  const path = endpoint.split('?')[0];
  return path === '/auth/login' || path === '/auth/register' || path === '/auth/refresh' || path === '/auth/logout';
}

/** When a request included a Bearer token, 401 means session is dead — clear storage and notify router. */
function clearSessionIfUnauthorized(endpoint: string, status: number, hadAuth: boolean): void {
  if (status !== 401 || !hadAuth || isPublicAuthEndpoint(endpoint)) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('user_name');
  broadcastAuthSessionExpired();
}

type RawResponse<T> = { response: Response; data: { data?: T; message?: string; code?: string; details?: unknown } };

class ApiClient {
  private async performFetch<T>(
    endpoint: string,
    options: RequestInit,
    token: string | null,
  ): Promise<RawResponse<T>> {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string>),
      },
    };
    const response = await fetch(url, config);
    let data: { data?: T; message?: string; code?: string; details?: unknown } = {};
    try {
      data = await response.json();
    } catch {
      // non-JSON response
    }
    return { response, data };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let token = localStorage.getItem(TOKEN_KEY);

    try {
      let { response, data } = await this.performFetch<T>(endpoint, options, token);

      // Access token expired mid-session — try a silent refresh and retry once before
      // giving up. Only for requests that actually carried a token to a protected endpoint;
      // never for login/register/refresh/logout themselves (see isPublicAuthEndpoint).
      if (response.status === 401 && token && !isPublicAuthEndpoint(endpoint)) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          token = newToken;
          ({ response, data } = await this.performFetch<T>(endpoint, options, token));
        }
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(endpoint, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Request failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: T }).data ?? (data as unknown as T),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /** Builds a query string, skipping undefined/null/empty values. `true`/`false` become 'true'/'false'. */
  private static toQuery(params: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      sp.set(key, String(value));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
  }

  /**
   * Every list endpoint is now paginated server-side (backend's Sep 2026 pagination rollout —
   * see `Paginated<T>` in `types/api.ts`), capped at 100 records per page. The admin screens that
   * call `getAll()` still expect the *complete* list back (they search/sort/count client-side, and
   * some build dropdowns from it) — so this walks every page and concatenates `items`, keeping
   * `getAll()`'s contract exactly what it always was. A method that wants real server-side paging
   * (its own `page`/`limit`, for a future paged UI) should call `fetchPage` directly instead.
   */
  private static async fetchAllPages<T>(
    fetchPage: (page: number, limit: number) => Promise<ApiResponse<Paginated<T>>>,
  ): Promise<ApiResponse<T[]>> {
    const limit = 100;
    const items: T[] = [];
    let page = 1;
    let last: ApiResponse<Paginated<T>> | null = null;
    for (;;) {
      const res = await fetchPage(page, limit);
      last = res;
      const data = res.data;
      if (!data) break;
      items.push(...data.items);
      if (!data.meta.hasNextPage) break;
      page += 1;
    }
    return { ok: last?.ok ?? true, data: items, message: last?.message, status: last?.status };
  }

  auth = {
    register: async (
      data: RegisterRequest
    ): Promise<ApiResponse<AuthResponse>> => {
      return this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    login: async (data: LoginRequest): Promise<ApiResponse<AuthResponse>> => {
      return this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    getProfile: async (): Promise<ApiResponse<{ id: string; email: string; role: string; [key: string]: unknown }>> => {
      return this.request('/auth/profile');
    },

    /**
     * Explicit refresh call, e.g. for a "keep me signed in" flow triggered by the UI.
     * The automatic retry-on-401 inside `request()` does NOT go through this method —
     * see `refreshAccessToken` in `src/auth/authSession.ts` for why.
     */
    refresh: async (refreshToken: string): Promise<ApiResponse<AuthResponse>> => {
      return this.request<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    },

    logout: async (refreshToken: string): Promise<ApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    },

    /**
     * `POST /auth/change-password` — the one route exempt from the `PASSWORD_CHANGE_REQUIRED`
     * lock (`@BypassPasswordChange()` on the backend), so it can be called by an account that's
     * currently forced into it. See `src/auth/gateDecision.ts`.
     */
    changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  /** POST /upload - multipart form field "file". Returns { url, public_id }. */
  upload = {
    file: async (file: File): Promise<ApiResponse<{ url: string; public_id?: string }>> => {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${API_BASE}/upload`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      let data: { data?: { url: string; public_id?: string }; url?: string; public_id?: string; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON
      }
      if (!response.ok) {
        clearSessionIfUnauthorized('/upload', response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Upload failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }
      const result = (data as { data?: { url: string; public_id?: string } }).data ?? (data as { url?: string; public_id?: string });
      const urlVal = result?.url ?? (data as { url?: string }).url;
      if (!urlVal) throw new ApiError('Upload response missing url', response.status, 'INVALID_RESPONSE');
      return {
        ok: true,
        data: { url: urlVal, public_id: result?.public_id ?? (data as { public_id?: string }).public_id },
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  players = {
    createStandalone: async (
      data: PlayerCreateStandalone
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    createForTeam: async (
      data: PlayerCreateForTeam
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players/team', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    bulkCreateForTeam: async (
      body: PlayerBulkCreateRequest
    ): Promise<ApiResponse<{ createdCount?: number; duplicatesCount?: number; [key: string]: unknown }>> => {
      return this.request('/players/team/bulk', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    /** One page, server-side (search/sortBy/sortOrder on top of page/limit; max 100/page). */
    getPage: async (
      params?: { teamId?: string; unassigned?: boolean } & PaginationParams,
    ): Promise<ApiResponse<Paginated<Player>>> => {
      const qs = ApiClient.toQuery({ ...params, unassigned: params?.unassigned === true ? true : undefined });
      return this.request<Paginated<Player>>(`/players${qs}`);
    },

    /** The full roster matching `params`, walking every page — see `fetchAllPages`. */
    getAll: async (params?: { teamId?: string; unassigned?: boolean }): Promise<ApiResponse<Player[]>> =>
      ApiClient.fetchAllPages((page, limit) => this.players.getPage({ ...params, page, limit })),

    getById: async (id: string): Promise<ApiResponse<Player>> => {
      return this.request<Player>(`/players/${id}`);
    },

    update: async (
      id: string,
      data: PlayerUpdateBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>(`/players/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    assignToTeam: async (
      playerId: string,
      teamId: string,
      body?: PlayerAssignToTeamBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>(
        `/players/${playerId}/teams/${teamId}`,
        {
          method: 'PUT',
          body: JSON.stringify(body ?? {}),
        }
      );
    },

    removeFromTeam: async (
      playerId: string,
      teamId: string
    ): Promise<boolean> => {
      await this.request(`/players/${playerId}/teams/${teamId}`, {
        method: 'DELETE',
      });
      return true;
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/players/${id}`, { method: 'DELETE' });
      return true;
    },

    uploadExcel: async (
      teamId: string,
      file: File
    ): Promise<ApiResponse<PlayerUploadResult>> => {
      const formData = new FormData();
      formData.append('file', file);

      const url = `${API_BASE}/players/team/${teamId}/upload`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // Do not set Content-Type - browser sets multipart/form-data with boundary

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      let data: { data?: PlayerUploadResult; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/players/team/${teamId}/upload`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Upload failed',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: PlayerUploadResult }).data ?? (data as unknown as PlayerUploadResult),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },

    merge: async (
      body: PlayerMergeBody
    ): Promise<ApiResponse<Player>> => {
      return this.request<Player>('/players/merge', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  };

  teams = {
    create: async (data: TeamCreate): Promise<ApiResponse<Team>> => {
      return this.request<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /**
     * One page, server-side, of every team (not scoped to a tournament — see `getAll`'s doc
     * comment for why a `tournamentId` can't be sent here).
     */
    getPage: async (
      params?: PaginationParams,
    ): Promise<ApiResponse<Paginated<Team>>> => {
      const qs = ApiClient.toQuery({ ...params });
      return this.request<Paginated<Team>>(`/teams${qs}`);
    },

    /**
     * Every team matching `params`, walking every page — see `fetchAllPages`.
     *
     * `tournamentId` is deliberately NOT sent to `GET /teams`: the backend's
     * `TeamFilterDto.tournamentId` is validated with `@IsUUID()`, but every id in this app is a
     * cuid (e.g. "cmuidecfq0001…"), so the backend 400s on it ("tournamentId must be a UUID") —
     * confirmed live on the deployed API (see docs/BACKEND_GAPS.md). A tournament's teams are
     * available fully formed (with rosters) from the tournament's own detail endpoint instead, so
     * that's used as the workaround here.
     */
    getAll: async (params?: { tournamentId?: string }): Promise<ApiResponse<Team[]>> => {
      if (params?.tournamentId) {
        const res = await this.tournaments.getById(params.tournamentId);
        if (!res.ok || !res.data) return { ok: res.ok, data: undefined, message: res.message, status: res.status };
        const nested = (res.data as unknown as { teams?: Array<{ team?: Team }> }).teams ?? [];
        const teams = nested.map((tt) => tt.team).filter((t): t is Team => !!t);
        return { ok: true, data: teams, message: res.message, status: res.status };
      }
      return ApiClient.fetchAllPages((page, limit) => this.teams.getPage({ page, limit }));
    },

    getById: async (id: string): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${id}`);
    },

    update: async (
      id: string,
      data: TeamUpdate
    ): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/teams/${id}`, { method: 'DELETE' });
      return true;
    },

    setCaptain: async (
      teamId: string,
      playerId: string,
      data: TeamSetCaptainBody
    ): Promise<ApiResponse<Team>> => {
      return this.request<Team>(`/teams/${teamId}/players/${playerId}/captain`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  };

  tournaments = {
    create: async (
      data: TournamentCreate
    ): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /** One page, server-side (search/sortBy/sortOrder on top of page/limit; max 100/page). */
    getPage: async (params?: PaginationParams): Promise<ApiResponse<Paginated<Tournament>>> => {
      const qs = ApiClient.toQuery({ ...params });
      return this.request<Paginated<Tournament>>(`/tournaments${qs}`);
    },

    /** Every tournament, walking every page — see `fetchAllPages`. */
    getAll: async (): Promise<ApiResponse<Tournament[]>> =>
      ApiClient.fetchAllPages((page, limit) => this.tournaments.getPage({ page, limit })),

    getById: async (id: string): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/${id}`);
    },

    getByCode: async (code: string): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/code/${encodeURIComponent(code)}`);
    },

    update: async (
      id: string,
      data: TournamentUpdate
    ): Promise<ApiResponse<Tournament>> => {
      return this.request<Tournament>(`/tournaments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    addTeams: async (
      tournamentId: string,
      body: TournamentAddTeamsBody
    ): Promise<ApiResponse<unknown>> => {
      return this.request(`/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    removeTeam: async (
      tournamentId: string,
      teamId: string
    ): Promise<boolean> => {
      await this.request(
        `/tournaments/${tournamentId}/teams/${teamId}`,
        { method: 'DELETE' }
      );
      return true;
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/tournaments/${id}`, { method: 'DELETE' });
      return true;
    },

    /** PATCH /tournaments/:id/flyer - multipart form field "flyer". Returns updated Tournament with flyer URL. */
    uploadFlyer: async (
      id: string,
      file: File
    ): Promise<ApiResponse<Tournament>> => {
      const formData = new FormData();
      formData.append('flyer', file);

      const url = `${API_BASE}/tournaments/${id}/flyer`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      let data: { data?: Tournament; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/tournaments/${id}/flyer`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Failed to upload flyer',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: Tournament }).data ?? (data as unknown as Tournament),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  matches = {
    create: async (data: MatchCreate): Promise<ApiResponse<Match>> => {
      return this.request<Match>('/matches', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /** One page, server-side (search/sortBy/sortOrder on top of page/limit; max 100/page). */
    getPage: async (
      params?: { tournamentId?: string; status?: string } & PaginationParams,
    ): Promise<ApiResponse<Paginated<Match>>> => {
      const qs = ApiClient.toQuery({ ...params });
      return this.request<Paginated<Match>>(`/matches${qs}`);
    },

    /** Every match matching `params`, walking every page — see `fetchAllPages`. */
    getAll: async (params?: {
      tournamentId?: string;
      status?: string;
    }): Promise<ApiResponse<Match[]>> =>
      ApiClient.fetchAllPages((page, limit) => this.matches.getPage({ ...params, page, limit })),

    getById: async (id: string): Promise<ApiResponse<Match>> => {
      return this.request<Match>(`/matches/${id}`);
    },

    update: async (
      id: string,
      data: MatchUpdate
    ): Promise<ApiResponse<Match>> => {
      return this.request<Match>(`/matches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/matches/${id}`, { method: 'DELETE' });
      return true;
    },
  };

  admin = {
    create: async (data: AdminCreateBody): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>('/admin', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /** One page, server-side (search/sortBy/sortOrder, `role`, `status`; max 100/page). */
    getPage: async (
      params?: { role?: string; status?: string } & PaginationParams,
    ): Promise<ApiResponse<Paginated<Admin>>> => {
      const qs = ApiClient.toQuery({ ...params });
      return this.request<Paginated<Admin>>(`/admin${qs}`);
    },

    /** Every admin/super-admin, walking every page — see `fetchAllPages`. */
    getAll: async (): Promise<ApiResponse<Admin[]>> =>
      ApiClient.fetchAllPages((page, limit) => this.admin.getPage({ page, limit })),

    getById: async (id: string): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>(`/admin/${id}`);
    },

    update: async (
      id: string,
      data: AdminUpdateBody
    ): Promise<ApiResponse<Admin>> => {
      return this.request<Admin>(`/admin/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/admin/${id}`, { method: 'DELETE' });
      return true;
    },
  };

  statistician = {
    create: async (
      data: StatisticianCreateBody
    ): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>('/statistician', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /** One page, server-side (search/sortBy/sortOrder, `status`; max 100/page). */
    getPage: async (
      params?: { status?: string } & PaginationParams,
    ): Promise<ApiResponse<Paginated<Statistician>>> => {
      const qs = ApiClient.toQuery({ ...params });
      return this.request<Paginated<Statistician>>(`/statistician${qs}`);
    },

    /** Every statistician, walking every page — see `fetchAllPages`. */
    getAll: async (): Promise<ApiResponse<Statistician[]>> =>
      ApiClient.fetchAllPages((page, limit) => this.statistician.getPage({ page, limit })),

    getById: async (id: string): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>(`/statistician/${id}`);
    },

    update: async (
      id: string,
      data: StatisticianUpdateBody
    ): Promise<ApiResponse<Statistician>> => {
      return this.request<Statistician>(`/statistician/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: string): Promise<boolean> => {
      await this.request(`/statistician/${id}`, { method: 'DELETE' });
      return true;
    },

    /** PATCH /statistician/:id/photo - multipart form field "photo". Returns updated Statistician with photo URL. */
    uploadPhoto: async (
      id: string,
      file: File
    ): Promise<ApiResponse<Statistician>> => {
      const formData = new FormData();
      formData.append('photo', file);

      const url = `${API_BASE}/statistician/${id}/photo`;
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: formData,
      });

      let data: { data?: Statistician; message?: string; code?: string; details?: unknown } = {};
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      if (!response.ok) {
        clearSessionIfUnauthorized(`/statistician/${id}/photo`, response.status, !!token);
        throw new ApiError(
          (data as { message?: string }).message || 'Failed to upload statistician photo',
          response.status,
          (data as { code?: string }).code,
          (data as { details?: unknown }).details
        );
      }

      return {
        ok: true,
        data: (data as { data?: Statistician }).data ?? (data as unknown as Statistician),
        message: (data as { message?: string }).message,
        status: response.status,
      };
    },
  };

  ops = {
    getHealth: async (): Promise<{
      enabled: boolean;
      queues: Record<string, { active?: number; waiting?: number; completed?: number; failed?: number; delayed?: number; paused?: number }>;
    }> => {
      const res = await this.request<{ enabled: boolean; queues: Record<string, Record<string, number>> }>('/ops/queues/health');
      return res.data!;
    },

    getLag: async (): Promise<{
      enabled: boolean;
      lag: Record<string, { waiting: number; oldestWaitingMs: number }>;
    }> => {
      const res = await this.request<{ enabled: boolean; lag: Record<string, { waiting: number; oldestWaitingMs: number }> }>('/ops/queues/lag');
      return res.data!;
    },

    requeueDeadLetter: async (limit = 25): Promise<{ requeued: number }> => {
      const res = await this.request<{ requeued: number }>(`/ops/queues/dead-letter/requeue?limit=${limit}`, { method: 'POST' });
      return res.data!;
    },

    warmSession: async (sessionId: string): Promise<{ warmed: boolean; sessionId: string }> => {
      const res = await this.request<{ warmed: boolean; sessionId: string }>(`/ops/queues/warm/session?sessionId=${encodeURIComponent(sessionId)}`, { method: 'POST' });
      return res.data!;
    },
  };
}

export const apiClient = new ApiClient();
