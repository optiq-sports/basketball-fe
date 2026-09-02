import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import StatisticianLayout from '../../components/StatisticianLayout';
import { queryKeys, useMatches, useTeams } from '../../api/hooks';
import type { Match } from '../../types/api';
import { sessionsApi } from '../../services/statdash';
import { apiClient } from '../../api/ApiClient';
import {
  writeStoredExpectedVersion,
  writeStoredSessionContext,
} from '../../features/statdash/sessionContextStorage';
import { performLogout } from '../../auth/authSession';
import GrainOverlay from '../../components/decor/GrainOverlay';
import { GATEWAY_DISPLAY_FONT_STACK as DISPLAY_FONT_STACK, GATEWAY_FONT_STACK as FONT_STACK } from '../../authGatewayTheme';

const RECENT_LIMIT = 8;

function formatGameWhen(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const time = d
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .replace(/\s/g, '');
    const date = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${time}, ${date}`;
  } catch {
    return isoDate;
  }
}

function teamLabel(map: Map<string, { name: string; color: string }>, id: string, fallback: string): string {
  return map.get(id)?.name ?? fallback;
}

function teamColor(map: Map<string, { name: string; color: string }>, id: string, fallback: string): string {
  const c = map.get(id)?.color;
  if (c && /^#?[0-9a-f]{3,8}$/i.test(c)) {
    return c.startsWith('#') ? c : `#${c}`;
  }
  return fallback;
}

const MatchKey: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [matchKey, setMatchKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const handleLogout = useCallback(() => {
    performLogout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  }, [navigate, queryClient]);

  const completedQuery = useMatches(undefined, 'COMPLETED');
  const teamsQuery = useTeams();

  const teamMap = useMemo(() => {
    const list = teamsQuery.data ?? [];
    const map = new Map<string, { name: string; color: string }>();
    list.forEach((t) => map.set(t.id, { name: t.name, color: t.color ?? '' }));
    return map;
  }, [teamsQuery.data]);

  const recentGames = useMemo(() => {
    const list = [...(completedQuery.data ?? [])] as Match[];
    list.sort((a, b) => {
      const ta = new Date(a.scheduledDate).getTime();
      const tb = new Date(b.scheduledDate).getTime();
      return tb - ta;
    });
    return list.slice(0, RECENT_LIMIT);
  }, [completedQuery.data]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = matchKey.trim();
    if (!trimmed) {
      setKeyError('Please enter a match key');
      return;
    }
    setKeyError(null);
    setIsResolving(true);
    try {
      const resolved = await sessionsApi.resolveSession({ matchKey: trimmed });
      const snapshot = await sessionsApi.bootstrapSession({
        sessionId: resolved.sessionId ?? undefined,
        matchId: resolved.matchId,
      });
      sessionStorage.setItem('statistician_match_key', trimmed);
      writeStoredSessionContext({
        sessionId: snapshot.sessionId,
        matchId: snapshot.matchId,
        homeTeamId: (await apiClient.matches.getById(snapshot.matchId)).data?.homeTeamId,
        awayTeamId: (await apiClient.matches.getById(snapshot.matchId)).data?.awayTeamId,
      });
      writeStoredExpectedVersion(snapshot.version);
      // Game already started (starters/sides/jump-ball already done) — resume straight into
      // Stat Dash instead of re-running the one-time setup flow.
      if (snapshot.status === 'IN_PROGRESS' || snapshot.status === 'PAUSED') {
        navigate('/stat-dash');
      } else {
        navigate('/starters');
      }
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : 'Unable to resolve match key');
    } finally {
      setIsResolving(false);
    }
  };

  const listLoading = completedQuery.isPending || teamsQuery.isPending;
  const listError =
    completedQuery.error instanceof Error
      ? completedQuery.error.message
      : teamsQuery.error instanceof Error
        ? teamsQuery.error.message
        : null;

  return (
    <StatisticianLayout>
      <div
        className="relative flex flex-1 flex-col items-center overflow-x-hidden overflow-y-auto bg-[#0a0e15] px-[5vw] pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8"
        style={{ fontFamily: FONT_STACK }}
      >
        <img
          src="/match-key-hero.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[68%_30%] opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e15]/40 via-[#0a0e15]/85 to-[#0a0e15]" />
        <GrainOverlay />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center lg:max-w-lg">
          <div className="mb-6 flex w-full items-center justify-between">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded text-sm text-white/40 underline-offset-4 transition-colors hover:text-white/80 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              ← Log out
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
              Statistician
            </span>
          </div>

          {/* Logo */}
          <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-sm sm:mb-8 sm:h-[4.5rem] sm:w-[4.5rem]">
            <img
              src="/logo.png"
              alt="Optiq Sports logo"
              className="h-8 w-8 object-contain brightness-0 invert sm:h-9 sm:w-9"
            />
          </div>

          <div className="mb-8 w-full text-center sm:mb-10">
            <h1
              className="text-white"
              style={{
                fontFamily: DISPLAY_FONT_STACK,
                fontSize: 'clamp(2.25rem, 6vw, 2.75rem)',
                lineHeight: 1,
              }}
            >
              Enter match key
            </h1>
            <p className="mx-auto mt-3 max-w-xs px-1 text-sm leading-relaxed text-white/50 sm:text-[0.9375rem]">
              Get the key from your tournament admin to start scoring.
            </p>
          </div>

          <form onSubmit={handleContinue} className="mb-10 w-full space-y-3 sm:mb-12 sm:space-y-3.5">
            <label htmlFor="match-key" className="sr-only">
              Match Key
            </label>
            <input
              id="match-key"
              type="text"
              autoComplete="off"
              placeholder="MATCH KEY"
              value={matchKey}
              onChange={(e) => {
                setMatchKey(e.target.value);
                if (keyError) setKeyError(null);
              }}
              aria-invalid={!!keyError}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-center text-lg font-medium tracking-[0.2em] text-white placeholder-white/25 outline-none transition-colors focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 sm:px-5"
            />
            {keyError && <p className="px-0.5 text-center text-sm text-red-300">{keyError}</p>}
            <button
              type="submit"
              disabled={isResolving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#2563eb] py-3.5 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              {isResolving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {isResolving ? 'Resolving…' : 'Continue'}
            </button>
          </form>

          {/* Recent Games */}
          <section className="flex w-full max-w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
            <h2 className="px-4 pb-2 pt-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/40 sm:px-5 sm:pt-4">
              Recent games
            </h2>
            <div className="max-h-[min(40vh,280px)] overflow-y-auto overscroll-contain px-3 pb-3 sm:px-4 sm:pb-4">
              {listLoading && (
                <p className="py-6 text-center text-sm text-white/40">Loading games…</p>
              )}
              {!listLoading && listError && (
                <p className="px-2 py-4 text-center text-sm text-red-300">{listError}</p>
              )}
              {!listLoading && !listError && recentGames.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">No completed games yet</p>
              )}
              {!listLoading &&
                !listError &&
                recentGames.map((m) => {
                  const homeName = teamLabel(teamMap, m.homeTeamId, 'Home');
                  const awayName = teamLabel(teamMap, m.awayTeamId, 'Away');
                  const homeScore = m.totalHome ?? 0;
                  const awayScore = m.totalAway ?? 0;
                  const homeSwatch = teamColor(teamMap, m.homeTeamId, '#f97316');
                  const awaySwatch = teamColor(teamMap, m.awayTeamId, '#38bdf8');
                  const venue = m.venue?.trim() || 'Match Venue';
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 border-b border-white/[0.06] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: homeSwatch }}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-medium text-white/85">
                            {homeName} – {homeScore}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: awaySwatch }}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-medium text-white/85">
                            {awayName} – {awayScore}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-left text-xs text-white/40 sm:max-w-[11rem] sm:text-right sm:text-sm">
                        <p className="font-medium text-white/55">{venue}</p>
                        <p className="mt-0.5">{formatGameWhen(m.scheduledDate)}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default MatchKey;
