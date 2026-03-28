import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatisticianLayout from '../../components/StatisticianLayout';
import { useMatches, useTeams } from '../../api/hooks';
import type { Match } from '../../types/api';

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
  const [matchKey, setMatchKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

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

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = matchKey.trim();
    if (!trimmed) {
      setKeyError('Please enter a match key');
      return;
    }
    setKeyError(null);
    sessionStorage.setItem('statistician_match_key', trimmed);
    navigate('/starters');
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
      <div className="flex-1 flex flex-col items-center justify-center px-[5vw] sm:px-6 pb-10 sm:pb-12 pt-2 sm:pt-4">
        <div className="w-full max-w-md lg:max-w-lg mx-auto flex flex-col items-center">
          {/* Logo */}
          <div className="mb-6 sm:mb-8 rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 bg-[#3B5998]">
            <img
              src="/logo.png"
              alt="App logo"
              className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 object-contain p-2 brightness-0 invert"
            />
          </div>

          <div className="text-center mb-8 sm:mb-10 w-full">
            <h1
              className="text-gray-800 font-semibold tracking-tight mb-2"
              style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}
            >
              Welcome back <span className="font-bold text-gray-900">Statistician</span>
            </h1>
            <p className="text-gray-500 text-sm sm:text-[0.9375rem] leading-relaxed px-1">
              Enter <span className="font-semibold text-gray-700">Match Key</span> to proceed to continue
            </p>
          </div>

          <form onSubmit={handleContinue} className="w-full space-y-3 sm:space-y-3.5 mb-10 sm:mb-12">
            <label htmlFor="match-key" className="sr-only">
              Match Key
            </label>
            <input
              id="match-key"
              type="text"
              autoComplete="off"
              placeholder="Match Key"
              value={matchKey}
              onChange={(e) => {
                setMatchKey(e.target.value);
                if (keyError) setKeyError(null);
              }}
              className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-white border border-gray-200 rounded-lg sm:rounded-xl text-gray-900 placeholder:text-gray-400 text-base focus:outline-none focus:ring-2 focus:ring-[#3B5998]/40 focus:border-[#3B5998] transition-shadow"
            />
            {keyError && <p className="text-sm text-red-600 px-0.5">{keyError}</p>}
            <button
              type="submit"
              className="w-full py-3 sm:py-3.5 bg-[#3B5998] text-white font-medium rounded-lg sm:rounded-xl text-base transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3B5998]"
            >
              Continue
            </button>
          </form>

          {/* Recent Games */}
          <section className="w-full max-w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-0">
            <h2 className="text-xs sm:text-sm font-bold text-gray-700 px-4 pt-3 pb-2 sm:px-5 sm:pt-4">
              Recent Games
            </h2>
            <div className="max-h-[min(40vh,280px)] overflow-y-auto overscroll-contain px-3 sm:px-4 pb-3 sm:pb-4">
              {listLoading && (
                <p className="text-sm text-gray-500 py-6 text-center">Loading games…</p>
              )}
              {!listLoading && listError && (
                <p className="text-sm text-red-600 py-4 text-center px-2">{listError}</p>
              )}
              {!listLoading && !listError && recentGames.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center">No completed games yet</p>
              )}
              {!listLoading &&
                !listError &&
                recentGames.map((m) => {
                  const homeName = teamLabel(teamMap, m.homeTeamId, 'Home');
                  const awayName = teamLabel(teamMap, m.awayTeamId, 'Away');
                  const homeScore = m.totalHome ?? 0;
                  const awayScore = m.totalAway ?? 0;
                  const homeSwatch = teamColor(teamMap, m.homeTeamId, '#ea580c');
                  const awaySwatch = teamColor(teamMap, m.awayTeamId, '#2563eb');
                  const venue = m.venue?.trim() || 'Match Venue';
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: homeSwatch }}
                            aria-hidden
                          />
                          <span className="text-sm text-gray-800 font-medium truncate">
                            {homeName} – {homeScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: awaySwatch }}
                            aria-hidden
                          />
                          <span className="text-sm text-gray-800 font-medium truncate">
                            {awayName} – {awayScore}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-left sm:text-right text-xs sm:text-sm text-gray-500 sm:max-w-[11rem]">
                        <p className="font-medium text-gray-600">{venue}</p>
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
