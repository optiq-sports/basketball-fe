import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight } from 'react-icons/fi';
import { queryKeys } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import {
  getContrastTextColor,
  normalizeHex,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
const TOKEN_KEY = 'access_token';
const ROWS = 12;

/** Same default as main: rows 1–4 and 7 starters (0-based: 0,1,2,3,6) */
const DEFAULT_STARTER_ROWS = new Set([0, 1, 2, 3, 6]);
const MOCK_PLAYERS = Array.from({ length: ROWS }, (_, index) => ({
  id: index,
  jersey: index + 1,
  name: `Player ${index + 1}`,
}));

type TeamSide = 'home' | 'away';

function contrastTextOnBg(hex: string): string {
  return getContrastTextColor(hex);
}

const TEAM_SWATCHES = [
  '#FFFFFF',
  '#EF4444',
  '#DC2626',
  '#2563EB',
  '#1D4ED8',
  '#0EA5E9',
  '#16A34A',
  '#EAB308',
  '#F97316',
  '#A855F7',
  '#DB2777',
  '#111827',
  '#4B5563',
] as const;

/** Team color swatch + native color picker (main shows static “00”; we keep selection) */
function TeamColorBlock({
  side,
  color,
  onChange,
}: {
  side: TeamSide;
  color: string;
  onChange: (hex: string) => void;
}) {
  const fg = useMemo(() => contrastTextOnBg(color), [color]);
  const normalized = normalizeHex(color) ?? color;

  return (
    <div className="mt-3 flex justify-end">
      <div className="flex min-w-[170px] flex-col items-center gap-2 rounded-lg border border-gray-300 bg-white p-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Team Color</span>
        <div
          className="relative flex w-full items-center justify-center rounded-md border border-gray-300 px-4 py-1.5"
          style={{ backgroundColor: normalized }}
        >
          <span className="pointer-events-none text-sm font-bold tracking-widest" style={{ color: fg }}>
            00
          </span>
        </div>
        <div className="grid w-full grid-cols-6 gap-1">
          {TEAM_SWATCHES.map((swatch) => (
            <button
              key={`${side}-${swatch}`}
              type="button"
              onClick={() => onChange(swatch)}
              className={`h-6 rounded border focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                normalizeHex(color) === swatch ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300'
              }`}
              style={{ backgroundColor: swatch }}
              aria-label={`${side === 'home' ? 'Home' : 'Away'} team color ${swatch}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamColumn({
  side,
  playingSet,
  starterSet,
  onTogglePlaying,
  onToggle,
  teamColor,
  onTeamColorChange,
}: {
  side: TeamSide;
  playingSet: Set<number>;
  starterSet: Set<number>;
  onTogglePlaying: (rowIndex: number) => void;
  onToggle: (rowIndex: number) => void;
  teamColor: string;
  onTeamColorChange: (hex: string) => void;
}) {
  const playingPlayers = MOCK_PLAYERS.filter((p) => playingSet.has(p.id));
  const startingFive = playingPlayers.filter((p) => starterSet.has(p.id)).slice(0, 5);

  const chipClass = 'rounded-md border px-2 py-1 text-[11px] font-semibold';

  return (
    <div className="flex min-w-0 flex-col">
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-gray-800">TEAM NAME</h2>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">All Players</h3>
          <div className="grid grid-cols-4 gap-1">
            {MOCK_PLAYERS.map((player) => (
              <button
                key={`${side}-all-${player.id}`}
                type="button"
                onClick={() => onTogglePlaying(player.id)}
                className={`${chipClass} ${
                  playingSet.has(player.id)
                    ? 'border-sky-500 bg-sky-100 text-sky-800'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                #{player.jersey}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">Players Playing</h3>
          <div className="grid grid-cols-4 gap-1">
            {playingPlayers.map((player) => (
              <button
                key={`${side}-playing-${player.id}`}
                type="button"
                onClick={() => onToggle(player.id)}
                className={`${chipClass} ${
                  starterSet.has(player.id)
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                #{player.jersey}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-700">Selected First 5 Players Playing</h3>
          <div className="grid grid-cols-5 gap-1">
            {startingFive.map((player) => (
              <span
                key={`${side}-starting-${player.id}`}
                className={`${chipClass} border-emerald-500 bg-emerald-100 text-center text-emerald-800`}
              >
                #{player.jersey}
              </span>
            ))}
          </div>
        </div>
      </div>

      <TeamColorBlock side={side} color={teamColor} onChange={onTeamColorChange} />
    </div>
  );
}

const Starters: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { homeTeamColor, awayTeamColor, setHomeTeamColor, setAwayTeamColor } =
    useStatisticianTeamColors();
  const [homePlaying, setHomePlaying] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  const [awayPlaying, setAwayPlaying] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  const [homeStarters, setHomeStarters] = useState<Set<number>>(() => new Set(DEFAULT_STARTER_ROWS));
  const [awayStarters, setAwayStarters] = useState<Set<number>>(() => new Set(DEFAULT_STARTER_ROWS));

  useEffect(() => {
    if (!sessionStorage.getItem('statistician_match_key')) {
      navigate('/match-key', { replace: true });
    }
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_name');
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  }, [navigate, queryClient]);

  const toggleHome = useCallback((i: number) => {
    setHomeStarters((prev) => {
      if (!homePlaying.has(i)) return prev;
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      if (next.size > 5) {
        const firstFive = Array.from(next).sort((a, b) => a - b).slice(0, 5);
        return new Set(firstFive);
      }
      return next;
    });
  }, [homePlaying]);

  const toggleAway = useCallback((i: number) => {
    setAwayStarters((prev) => {
      if (!awayPlaying.has(i)) return prev;
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      if (next.size > 5) {
        const firstFive = Array.from(next).sort((a, b) => a - b).slice(0, 5);
        return new Set(firstFive);
      }
      return next;
    });
  }, [awayPlaying]);

  const toggleHomePlaying = useCallback((i: number) => {
    setHomePlaying((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      setHomeStarters((starters) => new Set(Array.from(starters).filter((id) => next.has(id)).slice(0, 5)));
      return next;
    });
  }, []);

  const toggleAwayPlaying = useCallback((i: number) => {
    setAwayPlaying((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      setAwayStarters((starters) => new Set(Array.from(starters).filter((id) => next.has(id)).slice(0, 5)));
      return next;
    });
  }, []);

  return (
    <StatisticianLayout>
      <div className="flex min-h-0 flex-1 flex-col bg-[#F0F2F5] font-sans">
        <div className="flex shrink-0 items-center justify-between px-8 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded text-sm text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={() => navigate('/choose-sides')}
            className="group flex items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900"
          >
            <FiArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            <span>Continue</span>
          </button>
        </div>

        <div className="flex-1 px-6 pb-8 pt-4">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6">
            <TeamColumn
              side="home"
              playingSet={homePlaying}
              starterSet={homeStarters}
              onTogglePlaying={toggleHomePlaying}
              onToggle={toggleHome}
              teamColor={homeTeamColor}
              onTeamColorChange={setHomeTeamColor}
            />
            <TeamColumn
              side="away"
              playingSet={awayPlaying}
              starterSet={awayStarters}
              onTogglePlaying={toggleAwayPlaying}
              onToggle={toggleAway}
              teamColor={awayTeamColor}
              onTeamColorChange={setAwayTeamColor}
            />
          </div>
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default Starters;
