import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight } from 'react-icons/fi';
import { queryKeys } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import {
  normalizeHex,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
const TOKEN_KEY = 'access_token';
const ROWS = 12;
/** Same avatar as main `Starts.tsx` (`PlayerAvatar`) */
const STARTER_PLAYER_IMAGE = '/dplayer.png';

/** Same default as main: rows 1–4 and 7 starters (0-based: 0,1,2,3,6) */
const DEFAULT_STARTER_ROWS = new Set([0, 1, 2, 3, 6]);

type TeamSide = 'home' | 'away';

function contrastTextOnBg(hex: string): string {
  const n = normalizeHex(hex);
  if (!n) return '#ffffff';
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#111827' : '#ffffff';
}

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
  const inputId = `team-color-input-${side}`;
  const fg = useMemo(() => contrastTextOnBg(color), [color]);

  return (
    <div className="mt-3 flex justify-end">
      <div className="flex min-w-[110px] flex-col items-center gap-1 rounded-lg border border-gray-300 bg-white p-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Team Color</span>
        <label
          htmlFor={inputId}
          className="relative flex w-full cursor-pointer items-center justify-center rounded-md px-4 py-1.5"
          style={{ backgroundColor: color }}
        >
          <span className="pointer-events-none text-sm font-bold tracking-widest" style={{ color: fg }}>
            00
          </span>
          <input
            id={inputId}
            type="color"
            value={normalizeHex(color) ?? color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={side === 'home' ? 'Home team color' : 'Away team color'}
          />
        </label>
      </div>
    </div>
  );
}

function PlayerAvatar() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-100" aria-hidden />;
  }
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-100">
      <img
        src={STARTER_PLAYER_IMAGE}
        alt="player"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </div>
  );
}

/** White box, neutral border + checkmark when selected */
function MainStyleStarterCheckbox({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  id: string;
}) {
  return (
    <button
      type="button"
      id={id}
      aria-checked={checked ? 'true' : 'false'}
      role="checkbox"
      onClick={onChange}
      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
        checked ? 'border-gray-800 bg-white' : 'border-gray-400 bg-white hover:border-gray-500'
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="h-3 w-3"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 6l3 3 5-5" />
        </svg>
      )}
    </button>
  );
}

function TeamColumn({
  side,
  starterSet,
  onToggle,
  teamColor,
  onTeamColorChange,
}: {
  side: TeamSide;
  starterSet: Set<number>;
  onToggle: (rowIndex: number) => void;
  teamColor: string;
  onTeamColorChange: (hex: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-gray-800">TEAM NAME</h2>

      <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          className="grid items-center px-4 py-2.5"
          style={{ gridTemplateColumns: '32px 1fr 80px', background: '#F3F4F6' }}
        >
          <span className="text-xs font-bold uppercase text-gray-800">#</span>
          <span className="text-xs font-bold uppercase text-gray-800">Player</span>
          <span className="pr-1 text-right text-xs font-bold uppercase text-gray-800">Starters</span>
        </div>

        <div>
          {Array.from({ length: ROWS }, (_, index) => (
            <div
              key={index}
              className={`grid items-center px-4 py-2.5 ${
                index < ROWS - 1 ? 'border-b border-gray-100' : ''
              }`}
              style={{ gridTemplateColumns: '32px 1fr 80px' }}
            >
              <span className="text-sm font-medium text-gray-700">8</span>

              <div className="flex items-center gap-2.5">
                <PlayerAvatar />
                <span className="text-sm font-medium text-gray-800">Name Surname</span>
              </div>

              <div className="flex justify-end pr-1">
                <MainStyleStarterCheckbox
                  id={`starter-${side}-${index}`}
                  checked={starterSet.has(index)}
                  onChange={() => onToggle(index)}
                />
              </div>
            </div>
          ))}
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
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const toggleAway = useCallback((i: number) => {
    setAwayStarters((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
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

        <div className="flex-1 px-6 pb-20 pt-4">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6">
            <TeamColumn
              side="home"
              starterSet={homeStarters}
              onToggle={toggleHome}
              teamColor={homeTeamColor}
              onTeamColorChange={setHomeTeamColor}
            />
            <TeamColumn
              side="away"
              starterSet={awayStarters}
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
