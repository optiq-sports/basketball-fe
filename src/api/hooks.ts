import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { apiClient } from './ApiClient';
import type {
  LoginRequest,
  RegisterRequest,
  AdminCreateBody,
  AdminUpdateBody,
  StatisticianCreateBody,
  StatisticianUpdateBody,
  PlayerCreateStandalone,
  PlayerCreateForTeam,
  PlayerBulkCreateRequest,
  PlayerUpdateBody,
  PlayerAssignToTeamBody,
  PlayerMergeBody,
  TeamCreate,
  TeamUpdate,
  TeamSetCaptainBody,
  TournamentCreate,
  TournamentUpdate,
  TournamentAddTeamsBody,
  MatchCreate,
  MatchUpdate,
  ChangePasswordRequest,
  ClientCreate,
} from '../types/api';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Query keys
export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  clients: ['clients'] as const,
  clientApiKeys: (clientId: string) => ['clientApiKeys', clientId] as const,
  myApiKeys: ['myApiKeys'] as const,
  matchesPage: (params: Record<string, unknown>) => ['matches', 'page', params] as const,
  players: (teamId?: string, unassigned?: boolean) =>
    (unassigned ? (['players', 'unassigned'] as readonly string[]) : teamId ? (['players', teamId] as readonly string[]) : ['players']) as readonly string[],
  player: (id: string) => ['player', id] as const,
  playersPage: (params: Record<string, unknown>) => ['players', 'page', params] as const,
  teams: (tournamentId?: string) =>
    (tournamentId ? (['teams', tournamentId] as readonly string[]) : ['teams']) as readonly string[],
  team: (id: string) => ['team', id] as const,
  tournaments: () => ['tournaments'] as const,
  tournamentsPage: (params: Record<string, unknown>) => ['tournaments', 'page', params] as const,
  teamsPage: (params: Record<string, unknown>) => ['teams', 'page', params] as const,
  tournament: (id: string) => ['tournament', id] as const,
  tournamentByCode: (code: string) => ['tournament', 'code', code] as const,
  matches: (tournamentId?: string, status?: string) =>
    (tournamentId || status
      ? (['matches', tournamentId, status].filter(Boolean) as readonly string[])
      : ['matches']) as readonly string[],
  match: (id: string) => ['match', id] as const,
  admins: () => ['admins'] as const,
  admin: (id: string) => ['admin', id] as const,
  statisticians: () => ['statisticians'] as const,
  statistician: (id: string) => ['statistician', id] as const,
  ops: {
    health: ['ops', 'health'] as const,
    lag: ['ops', 'lag'] as const,
  },
};

// ---------------------------------------------------------------------------------------------
// Optimistic UI helpers
//
// Every admin action used to look like nothing was happening until the request AND the refetch that
// follows it had both come back — a deleted game just sat there for seconds and then vanished. These
// apply the change to the cached lists/records right away, remember what was there so it can be put
// back if the server refuses, and let each hook reconcile with the server once it settles.
// ---------------------------------------------------------------------------------------------

type CacheEdit = { key: QueryKey; update: (data: unknown) => unknown };
type CacheSnapshot = { previous: Array<[QueryKey, unknown]> };

/** Applies each edit to every cached query under its key; returns what to restore on failure. */
async function applyOptimisticEdits(queryClient: QueryClient, edits: CacheEdit[]): Promise<CacheSnapshot> {
  await Promise.all(edits.map((edit) => queryClient.cancelQueries({ queryKey: edit.key })));
  const previous: CacheSnapshot['previous'] = [];
  for (const { key, update } of edits) {
    for (const [queryKey, data] of queryClient.getQueriesData({ queryKey: key })) {
      if (data === undefined) continue;
      previous.push([queryKey, data]);
      queryClient.setQueryData(queryKey, update(data));
    }
  }
  return { previous };
}

function rollbackOptimisticEdits(queryClient: QueryClient, context: CacheSnapshot | undefined): void {
  if (!context) return;
  // Restore newest-first so a query edited twice ends up at its original value.
  for (let i = context.previous.length - 1; i >= 0; i -= 1) {
    const [key, data] = context.previous[i];
    queryClient.setQueryData(key, data);
  }
}

const idOf = (item: unknown): unknown => (item as { id?: unknown } | null)?.id;

/** Drops the item with this id from a cached list (leaves anything that isn't a list alone). */
export const removeById = (id: string) => (data: unknown): unknown => {
  if (Array.isArray(data)) return data.filter((item) => idOf(item) !== id);
  if (isPagedList(data)) {
    const items = data.items.filter((item) => idOf(item) !== id);
    const removed = items.length < data.items.length;
    return { ...data, items, meta: { ...data.meta, itemCount: Math.max(0, data.meta.itemCount - (removed ? 1 : 0)) } };
  }
  return data;
};

/** A page from a paginated list: `{ items, meta }` as the backend returns it. */
export interface PagedList {
  items: unknown[];
  meta: { itemCount: number };
}
export const isPagedList = (data: unknown): data is PagedList =>
  !!data && typeof data === 'object' && Array.isArray((data as PagedList).items);

const definedOnly = (patch: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));

/** Merges a patch into the item with this id in a cached list. Undefined fields are skipped: they
 * mean "leave as is" when sent, so they must not blank the optimistic copy either. */
export const patchById = (id: string, patch: object) => (data: unknown): unknown => {
  const apply = (item: unknown) => (idOf(item) === id ? { ...(item as object), ...definedOnly(patch) } : item);
  if (Array.isArray(data)) return data.map(apply);
  if (isPagedList(data)) return { ...data, items: data.items.map(apply) };
  return data;
};

/** Merges a patch into a single cached record. */
export const patchRecord = (patch: object) => (data: unknown): unknown =>
  data && typeof data === 'object' && !Array.isArray(data) ? { ...data, ...definedOnly(patch) } : data;

/** Refetches after a change. Returned from a mutation's onSuccess, the mutation stays "pending"
 * until the fresh data is in, so a form's Save button keeps saying "Saving…" until the new row is
 * actually on screen instead of closing the form first and having the row appear seconds later. */
const refreshAll = (queryClient: QueryClient, keys: QueryKey[]): Promise<unknown> =>
  Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

// Auth hooks
export function useProfile(enabled = true) {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY);
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => {
      const res = await apiClient.auth.getProfile();
      if (!res.ok || res.data === undefined) throw new Error(res.message ?? 'Failed to load profile');
      return res.data;
    },
    enabled: enabled && hasToken,
    /** App default staleTime is 5m; profile must revalidate so expired tokens are not hidden behind cache. */
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await apiClient.auth.login(data);
      if (!res.ok) throw new Error(res.message ?? 'Login failed');
      return res;
    },
    onSuccess: (res) => {
      const token = res.data?.access_token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        if (res.data?.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
        }
        const user = res.data?.user as { name?: string; forcePasswordChange?: boolean } | undefined;
        // The login response is only a safe stand-in for the profile if it says whether the account must
        // change its password. It doesn't today (the field is missing), and a profile without the flag
        // reads as "no change needed", so a user with a temporary password saw the whole app until the
        // real profile arrived and swapped the screen. Without the flag, drop the cache instead, so the
        // gate waits for the real profile, which does carry it.
        if (user && typeof user.forcePasswordChange === 'boolean') {
          queryClient.setQueryData(queryKeys.auth.profile, user);
        } else {
          queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
        }
        if (user?.name != null && String(user.name).trim()) {
          localStorage.setItem('user_name', String(user.name).trim());
        }
      }
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const res = await apiClient.auth.register(data);
      if (!res.ok) throw new Error(res.message ?? 'Register failed');
      return res;
    },
    onSuccess: (res) => {
      const token = res.data?.access_token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        if (res.data?.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
        }
        queryClient.setQueryData(queryKeys.auth.profile, res.data?.user ?? null);
        const user = res.data?.user as { name?: string } | undefined;
        if (user?.name != null && String(user.name).trim()) {
          localStorage.setItem('user_name', String(user.name).trim());
        }
      }
    },
  });
}

/**
 * `POST /auth/change-password` — used both by a voluntary password change and by the forced
 * change-password screen (`src/pages/login/ChangePasswordRequired.tsx`) a `PASSWORD_CHANGE_REQUIRED`
 * profile fetch lands the user on. On success, the profile is marked stale so the next read sees
 * `forcePasswordChange: false` and `AppGate` lets the user through.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const res = await apiClient.auth.changePassword(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to change password');
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await apiClient.upload.file(file);
      if (!res.ok) throw new Error(res.message ?? 'Upload failed');
      return res.data!;
    },
  });
}

// Note: Users API is not included in the Basketball Management API (Postman collection).
// User management hooks have been removed. Use auth/profile for current user only.

// Player hooks
/**
 * One page of players, server-side. `search` matches first/last name only, and the only filters the
 * backend accepts are `teamId` and `unassigned` — anything else (a position, say) is rejected with a
 * 400 by its global `forbidNonWhitelisted` pipe. `sortBy` must be a column on the player table, so
 * jersey number and team name can't be sorted on (they live on the join table).
 */
export function usePlayersPage(params: {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  teamId?: string;
  unassigned?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.playersPage(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiClient.players.getPage(params);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load players');
      return res.data!;
    },
    placeholderData: (previous) => previous,
  });
}

export function usePlayers(teamId?: string, options?: { unassigned?: boolean }) {
  const unassigned = options?.unassigned === true;
  return useQuery({
    queryKey: queryKeys.players(teamId, unassigned),
    queryFn: async () => {
      const res = await apiClient.players.getAll(
        unassigned ? { unassigned: true } : teamId ? { teamId } : undefined
      );
      if (!res.ok) throw new Error(res.message ?? 'Failed to load players');
      return res.data ?? [];
    },
  });
}

export function usePlayer(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.player(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.players.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load player');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreatePlayerStandalone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerCreateStandalone) => {
      const res = await apiClient.players.createStandalone(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create player');
      return res.data!;
    },
    onSuccess: () =>
      refreshAll(queryClient, [
        ['players'],
      ]),
  });
}

export function useCreatePlayerForTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerCreateForTeam) => {
      const res = await apiClient.players.createForTeam(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create player');
      return res.data!;
    },
    onSuccess: (_, variables) =>
      refreshAll(queryClient, [
        queryKeys.players(),
        queryKeys.players(variables.teamId),
        queryKeys.team(variables.teamId),
      ]),
  });
}

export function useBulkCreatePlayersForTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlayerBulkCreateRequest) => {
      const res = await apiClient.players.bulkCreateForTeam(data);
      if (!res.ok) throw new Error(res.message ?? 'Bulk create failed');
      return res.data!;
    },
    onSuccess: (_, variables) =>
      refreshAll(queryClient, [
        queryKeys.players(),
        queryKeys.players(variables.teamId),
        queryKeys.team(variables.teamId),
      ]),
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: PlayerUpdateBody }) => {
      const res = await apiClient.players.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update player');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        ['players'],
        queryKeys.player(data.id),
        ...(data.teamId
          ? [queryKeys.players(data.teamId as string), queryKeys.team(data.teamId as string)]
          : []),
      ]),
  });
}

export function useAssignPlayerToTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playerId,
      teamId,
      body,
    }: {
      playerId: string;
      teamId: string;
      body?: PlayerAssignToTeamBody;
    }) => {
      const res = await apiClient.players.assignToTeam(playerId, teamId, body);
      if (!res.ok) throw new Error(res.message ?? 'Failed to assign player');
      return res.data!;
    },
    onSuccess: (_, variables) =>
      refreshAll(queryClient, [
        ['players'],
        queryKeys.players(variables.teamId),
        queryKeys.player(variables.playerId),
        queryKeys.team(variables.teamId),
      ]),
  });
}

export function useRemovePlayerFromTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playerId,
      teamId,
    }: { playerId: string; teamId: string }) => {
      await apiClient.players.removeFromTeam(playerId, teamId);
    },
    // The player leaves the roster on screen right away.
    onMutate: ({ playerId, teamId }) =>
      applyOptimisticEdits(queryClient, [
        { key: queryKeys.players(teamId), update: removeById(playerId) },
        {
          key: queryKeys.team(teamId),
          update: (data) => {
            const team = data as { playerTeams?: Array<{ playerId?: string; player?: { id?: string } }> };
            return Array.isArray(team?.playerTeams)
              ? {
                  ...team,
                  playerTeams: team.playerTeams.filter((pt) => (pt.playerId ?? pt.player?.id) !== playerId),
                }
              : data;
          },
        },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, variables) =>
      refreshAll(queryClient, [
        ['players'],
        queryKeys.players(variables.teamId),
        queryKeys.player(variables.playerId),
        queryKeys.team(variables.teamId),
      ]),
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.players.delete(id);
    },
    // Optimistic UI: remove the row from every cached players list immediately
    // (bare ['players'], team-scoped, and unassigned variants all match via the
    // partial ['players'] key), roll back on error, reconcile with the server on settle.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['players'] });
      const previous = queryClient.getQueriesData<Array<{ id: string }>>({ queryKey: ['players'] });
      queryClient.setQueriesData<Array<{ id: string }>>({ queryKey: ['players'] }, (old) =>
        old ? old.filter((p) => p.id !== id) : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.player(id) });
    },
  });
}

export function useUploadPlayersExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      file,
    }: { teamId: string; file: File }) => {
      const res = await apiClient.players.uploadExcel(teamId, file);
      if (!res.ok) throw new Error(res.message ?? 'Upload failed');
      return res.data!;
    },
    onSuccess: (_, variables) =>
      refreshAll(queryClient, [
        ['players'],
        queryKeys.players(variables.teamId),
        queryKeys.team(variables.teamId),
      ]),
  });
}

export function useMergePlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PlayerMergeBody) => {
      const res = await apiClient.players.merge(body);
      if (!res.ok) throw new Error(res.message ?? 'Merge failed');
      return res.data!;
    },
    onSuccess: (data, variables) =>
      refreshAll(queryClient, [
        ['players'],
        queryKeys.player(data.id),
        queryKeys.player(variables.duplicatePlayerId),
        queryKeys.player(variables.targetPlayerId),
      ]),
  });
}

// Team hooks
/** One page of teams, server-side (search/sortBy/sortOrder/page). `params` belong in the URL. */
export function useTeamsPage(params: { search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.teamsPage(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiClient.teams.getPage(params);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load teams');
      return res.data!;
    },
    placeholderData: (previous) => previous,
  });
}

export function useTeams(tournamentId?: string) {
  return useQuery({
    queryKey: queryKeys.teams(tournamentId),
    queryFn: async () => {
      const res = await apiClient.teams.getAll(
        tournamentId ? { tournamentId } : undefined
      );
      if (!res.ok) throw new Error(res.message ?? 'Failed to load teams');
      return res.data ?? [];
    },
  });
}

export function useTeam(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.team(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.teams.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load team');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TeamCreate) => {
      const res = await apiClient.teams.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create team');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        queryKeys.teams(),
        queryKeys.team(data.id),
      ]),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeamUpdate }) => {
      const res = await apiClient.teams.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update team');
      return res.data!;
    },
    onMutate: ({ id, data }) =>
      applyOptimisticEdits(queryClient, [
        { key: ['teams'], update: patchById(id, data) },
        { key: queryKeys.team(id), update: patchRecord(data) },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, { id }) => refreshAll(queryClient, [queryKeys.teams(), queryKeys.team(id)]),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.teams.delete(id);
    },
    onMutate: (id: string) => applyOptimisticEdits(queryClient, [{ key: ['teams'], update: removeById(id) }]),
    onError: (_err, _id, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: () => refreshAll(queryClient, [queryKeys.teams()]),
  });
}

export function useSetTeamCaptain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      playerId,
      body,
    }: { teamId: string; playerId: string; body: TeamSetCaptainBody }) => {
      const res = await apiClient.teams.setCaptain(teamId, playerId, body);
      if (!res.ok) throw new Error(res.message ?? 'Failed to set team captain');
      return res.data!;
    },
    // The captain dropdown and roster badges change immediately: exactly one captain per team.
    onMutate: ({ teamId, playerId, body }) =>
      applyOptimisticEdits(queryClient, [
        {
          key: queryKeys.players(teamId),
          update: (data) =>
            Array.isArray(data)
              ? data.map((p) => ({
                  ...(p as object),
                  isCaptain: idOf(p) === playerId ? body.isCaptain : body.isCaptain ? false : (p as { isCaptain?: boolean }).isCaptain,
                }))
              : data,
        },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, variables) =>
      refreshAll(queryClient, [
        queryKeys.team(variables.teamId),
        queryKeys.teams(),
        queryKeys.players(variables.teamId),
      ]),
  });
}

// Tournament hooks
/** One page of tournaments, server-side (search / sortBy / sortOrder / page). `params` belong in the URL. */
export function useTournamentsPage(params: { search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.tournamentsPage(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiClient.tournaments.getPage(params);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournaments');
      return res.data!;
    },
    placeholderData: (previous) => previous,
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: queryKeys.tournaments(),
    queryFn: async () => {
      const res = await apiClient.tournaments.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournaments');
      return res.data ?? [];
    },
  });
}

export function useTournament(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournament(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.tournaments.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournament');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useTournamentByCode(code: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournamentByCode(code ?? ''),
    queryFn: async () => {
      const res = await apiClient.tournaments.getByCode(code!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load tournament');
      return res.data!;
    },
    enabled: enabled && !!code,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TournamentCreate) => {
      const res = await apiClient.tournaments.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create tournament');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        queryKeys.tournaments(),
        queryKeys.tournament(data.id),
      ]),
  });
}

export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: TournamentUpdate }) => {
      const res = await apiClient.tournaments.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update tournament');
      return res.data!;
    },
    onMutate: ({ id, data }) =>
      applyOptimisticEdits(queryClient, [
        { key: queryKeys.tournaments(), update: patchById(id, data) },
        { key: queryKeys.tournament(id), update: patchRecord(data) },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, { id }) =>
      refreshAll(queryClient, [queryKeys.tournaments(), queryKeys.tournament(id)]),
  });
}

export function useUploadTournamentFlyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await apiClient.tournaments.uploadFlyer(id, file);
      if (!res.ok) throw new Error(res.message ?? 'Failed to upload tournament flyer');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        queryKeys.tournaments(),
        queryKeys.tournament(data.id),
      ]),
  });
}

export function useTournamentAddTeams() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      body,
    }: { tournamentId: string; body: TournamentAddTeamsBody }) => {
      await apiClient.tournaments.addTeams(tournamentId, body);
    },
    onSuccess: (_, variables) =>
      refreshAll(queryClient, [
        queryKeys.tournaments(),
        queryKeys.tournament(variables.tournamentId),
      ]),
  });
}

/**
 * Moves a team to another group. The backend upserts the team's link with the new group, so this is the
 * add endpoint again. The group shows at once on the tournament, and goes back if the server refuses.
 */
export function useSetTournamentTeamGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, teamId, group }: { tournamentId: string; teamId: string; group: string }) => {
      await apiClient.tournaments.addTeams(tournamentId, { teamIds: [teamId], group });
    },
    onMutate: ({ tournamentId, teamId, group }) =>
      applyOptimisticEdits(queryClient, [
        {
          key: queryKeys.tournament(tournamentId),
          update: (data) => {
            const t = data as { teams?: Array<{ teamId?: string; group?: string | null }> };
            return Array.isArray(t?.teams)
              ? { ...t, teams: t.teams.map((x) => (x.teamId === teamId ? { ...x, group } : x)) }
              : data;
          },
        },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_d, _e, variables) =>
      refreshAll(queryClient, [queryKeys.tournament(variables.tournamentId)]),
  });
}

export function useTournamentRemoveTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      teamId,
    }: { tournamentId: string; teamId: string }) => {
      await apiClient.tournaments.removeTeam(tournamentId, teamId);
    },
    onMutate: ({ tournamentId, teamId }) =>
      applyOptimisticEdits(queryClient, [
        {
          key: queryKeys.tournament(tournamentId),
          update: (data) => {
            const t = data as { teams?: Array<{ teamId?: string }> };
            return Array.isArray(t?.teams) ? { ...t, teams: t.teams.filter((x) => x.teamId !== teamId) } : data;
          },
        },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, variables) =>
      refreshAll(queryClient, [queryKeys.tournaments(), queryKeys.tournament(variables.tournamentId)]),
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.tournaments.delete(id);
    },
    onMutate: (id: string) =>
      applyOptimisticEdits(queryClient, [{ key: queryKeys.tournaments(), update: removeById(id) }]),
    onError: (_err, _id, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: () => refreshAll(queryClient, [queryKeys.tournaments()]),
  });
}

// Match hooks
export function useMatches(tournamentId?: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.matches(tournamentId, status),
    queryFn: async () => {
      const res = await apiClient.matches.getAll(
        tournamentId || status ? { tournamentId, status } : undefined
      );
      if (!res.ok) throw new Error(res.message ?? 'Failed to load matches');
      return res.data ?? [];
    },
  });
}

export function useMatch(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.match(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.matches.getById(id!);
      if (!res.ok) throw Object.assign(new Error(res.message ?? 'Failed to load match'), { status: res.status });
      return res.data!;
    },
    enabled: enabled && !!id,
    // A match that isn't found (or isn't yours to see) won't appear on a retry; waiting out the default
    // retries left the page on a spinner for about seven seconds before showing the error.
    retry: (failureCount, error) => (error as { status?: number }).status !== 404 && failureCount < 2,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: MatchCreate) => {
      const res = await apiClient.matches.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create match');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        ['matches'],
        queryKeys.matches(data.tournamentId),
        queryKeys.match(data.id),
      ]),
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MatchUpdate }) => {
      const res = await apiClient.matches.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update match');
      return res.data!;
    },
    // Status, date, venue, scores and the assigned statistician change on screen immediately.
    onMutate: ({ id, data }) =>
      applyOptimisticEdits(queryClient, [
        { key: ['matches'], update: patchById(id, data) },
        { key: queryKeys.match(id), update: patchRecord(data) },
      ]),
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, { id }) => refreshAll(queryClient, [['matches'], queryKeys.match(id)]),
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.matches.delete(id);
    },
    // The game leaves every fixtures list the moment it's deleted; it comes back with an error if
    // the server refuses.
    onMutate: (id: string) => applyOptimisticEdits(queryClient, [{ key: ['matches'], update: removeById(id) }]),
    onError: (_err, _id, context) => rollbackOptimisticEdits(queryClient, context),
    // Refresh the lists only. Refetching the deleted match's own record would 404 and flash an
    // error on its detail page just before it navigates away.
    onSettled: () => refreshAll(queryClient, [['matches'], queryKeys.tournaments()]),
  });
}

// Admin hooks
export function useAdmins() {
  return useQuery({
    queryKey: queryKeys.admins(),
    queryFn: async () => {
      const res = await apiClient.admin.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load admins');
      return res.data ?? [];
    },
  });
}

export function useAdmin(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.admin.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load admin');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AdminCreateBody) => {
      const res = await apiClient.admin.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create admin');
      return res.data!;
    },
    onSuccess: () =>
      refreshAll(queryClient, [
        queryKeys.admins(),
      ]),
  });
}

export function useUpdateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: AdminUpdateBody }) => {
      const res = await apiClient.admin.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update admin');
      return res.data!;
    },
    // The password is write-only and never part of a row, so it's left out of the optimistic patch.
    onMutate: ({ id, data }) => {
      const { password: _password, ...visible } = data;
      return applyOptimisticEdits(queryClient, [{ key: queryKeys.admins(), update: patchById(id, visible) }]);
    },
    onError: (_err, _vars, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, { id }) => refreshAll(queryClient, [queryKeys.admins(), queryKeys.admin(id)]),
  });
}

/**
 * Deactivates an admin. `DELETE /admin/:id` only sets the status to INACTIVE and the admins list shows
 * inactive accounts too, so the row stays and flips to Inactive rather than disappearing.
 */
export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.admin.delete(id);
    },
    onMutate: (id: string) =>
      applyOptimisticEdits(queryClient, [{ key: queryKeys.admins(), update: patchById(id, { status: 'INACTIVE' }) }]),
    onError: (_err, _id, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: (_data, _err, id) => refreshAll(queryClient, [queryKeys.admins(), queryKeys.admin(id)]),
  });
}

// Statistician hooks
/**
 * Every statistician with this status. `GET /statistician` answers ACTIVE only when no status is
 * sent, so a deactivated statistician is invisible unless INACTIVE is asked for by name. The backend
 * also computes `search` and then never applies it, so the page filters this full list itself.
 */
export function useStatisticians(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
  return useQuery({
    queryKey: [...queryKeys.statisticians(), { status }] as const,
    queryFn: async () => {
      const res = await apiClient.statistician.getAll(status);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load statisticians');
      return res.data ?? [];
    },
  });
}

export function useStatistician(id: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.statistician(id ?? ''),
    queryFn: async () => {
      const res = await apiClient.statistician.getById(id!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load statistician');
      return res.data!;
    },
    enabled: enabled && !!id,
  });
}

export function useCreateStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: StatisticianCreateBody) => {
      const res = await apiClient.statistician.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create statistician');
      return res.data!;
    },
    onSuccess: () =>
      refreshAll(queryClient, [
        queryKeys.statisticians(),
      ]),
  });
}

export function useUpdateStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: { id: string; data: StatisticianUpdateBody }) => {
      const res = await apiClient.statistician.update(id, data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to update statistician');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        queryKeys.statisticians(),
        queryKeys.statistician(data.id),
      ]),
  });
}

export function useUploadStatisticianPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const res = await apiClient.statistician.uploadPhoto(id, file);
      if (!res.ok) throw new Error(res.message ?? 'Failed to upload statistician photo');
      return res.data!;
    },
    onSuccess: (data) =>
      refreshAll(queryClient, [
        queryKeys.statisticians(),
        queryKeys.statistician(data.id),
      ]),
  });
}

export function useDeleteStatistician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.statistician.delete(id);
    },
    onMutate: (id: string) =>
      applyOptimisticEdits(queryClient, [{ key: queryKeys.statisticians(), update: removeById(id) }]),
    onError: (_err, _id, context) => rollbackOptimisticEdits(queryClient, context),
    onSettled: () => refreshAll(queryClient, [queryKeys.statisticians()]),
  });
}

// Ops / Queue hooks
export function useQueueHealth() {
  return useQuery({
    queryKey: queryKeys.ops.health,
    queryFn: () => apiClient.ops.getHealth(),
    refetchInterval: 30_000,
  });
}

export function useQueueLag() {
  return useQuery({
    queryKey: queryKeys.ops.lag,
    queryFn: () => apiClient.ops.getLag(),
    refetchInterval: 30_000,
  });
}

export function useRequeueDeadLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit: number) => apiClient.ops.requeueDeadLetter(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.health });
      queryClient.invalidateQueries({ queryKey: queryKeys.ops.lag });
    },
  });
}

export function useWarmSession() {
  return useMutation({
    mutationFn: (sessionId: string) => apiClient.ops.warmSession(sessionId),
  });
}

// Clients & API keys (Internal Administration)

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: async () => {
      const res = await apiClient.clients.getAll();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load clients');
      return res.data ?? [];
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClientCreate) => {
      const res = await apiClient.clients.create(data);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create client');
      return res.data!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useAssignClientUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, userId }: { clientId: string; userId: string }) => {
      const res = await apiClient.clients.assignUser(clientId, userId);
      if (!res.ok) throw new Error(res.message ?? 'Failed to assign user');
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useClientApiKeys(clientId: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.clientApiKeys(clientId ?? ''),
    queryFn: async () => {
      const res = await apiClient.clients.listApiKeys(clientId!);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load API keys');
      return res.data ?? [];
    },
    enabled: !!clientId,
  });
}

export function useCreateClientApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, name }: { clientId: string; name: string }) => {
      const res = await apiClient.clients.createApiKey(clientId, name);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create API key');
      return res.data!;
    },
    onSuccess: (_data, { clientId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientApiKeys(clientId) });
    },
  });
}

export function useRevokeClientApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const res = await apiClient.clients.revokeApiKey(id);
      if (!res.ok) throw new Error(res.message ?? 'Failed to revoke API key');
      return res;
    },
    // Optimistic: the key leaves the list at once, and comes back with the server's reason if refused.
    onMutate: async ({ id, clientId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.clientApiKeys(clientId) });
      const previous = queryClient.getQueryData<Array<{ id: string }>>(queryKeys.clientApiKeys(clientId));
      queryClient.setQueryData(queryKeys.clientApiKeys(clientId), (old?: Array<{ id: string }>) =>
        old?.filter((k) => k.id !== id),
      );
      return { previous, clientId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKeys.clientApiKeys(ctx.clientId), ctx.previous);
    },
    onSettled: (_d, _e, { clientId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientApiKeys(clientId) });
    },
  });
}

// Client portal: the signed-in CLIENT user's own data

/** One page of matches, scoped by the backend to the caller's client. `params` belong in the URL. */
export function useMatchesPage(params: {
  tournamentId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: queryKeys.matchesPage(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await apiClient.matches.getPage(params);
      if (!res.ok) throw new Error(res.message ?? 'Failed to load matches');
      return res.data!;
    },
    placeholderData: (previous) => previous,
  });
}

export function useMyApiKeys() {
  return useQuery({
    queryKey: queryKeys.myApiKeys,
    queryFn: async () => {
      const res = await apiClient.clients.listMyApiKeys();
      if (!res.ok) throw new Error(res.message ?? 'Failed to load API keys');
      return res.data ?? [];
    },
  });
}

export function useCreateMyApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.clients.createMyApiKey(name);
      if (!res.ok) throw new Error(res.message ?? 'Failed to create API key');
      return res.data!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myApiKeys });
    },
  });
}

/** Revokes one of the caller's keys. Optimistic, with rollback and the server's reason on failure. */
export function useRevokeMyApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.clients.revokeApiKey(id);
      if (!res.ok) throw new Error(res.message ?? 'Failed to revoke API key');
      return res;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.myApiKeys });
      const previous = queryClient.getQueryData<Array<{ id: string }>>(queryKeys.myApiKeys);
      queryClient.setQueryData(queryKeys.myApiKeys, (old?: Array<{ id: string }>) => old?.filter((k) => k.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKeys.myApiKeys, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myApiKeys });
    },
  });
}

