import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight } from 'react-icons/fi';
import { queryKeys } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import {
  getContrastTextColor,
  isLightColor,
  normalizeHex,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
const TOKEN_KEY = 'access_token';
const ROWS = 12;
const STARTER_PLAYER_IMAGE = '/dplayer.png';
const DEFAULT_PLAYING_ROWS = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

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
    <div className="flex justify-center sm:justify-end">
      <div className="flex min-w-[170px] flex-col items-center gap-2 rounded-lg border border-gray-300 bg-white p-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Team Color</span>
        <div
          className="relative flex w-full items-center justify-center rounded-md border border-gray-300 px-4 py-1.5"
          style={{
            backgroundColor: normalized,
            ...(isLightColor(normalized) ? { boxShadow: 'inset 0 0 0 1px rgba(17, 24, 39, 0.35)' } : {}),
          }}
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
              style={{
                backgroundColor: swatch,
                ...(isLightColor(swatch) ? { boxShadow: 'inset 0 0 0 1px rgba(17, 24, 39, 0.35)' } : {}),
              }}
              aria-label={`${side === 'home' ? 'Home' : 'Away'} team color ${swatch}`}
            />
          ))}
        </div>
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

function MainStyleStarterCheckbox({
  selected,
  label,
  kind,
  onClick,
  disabled = false,
}: {
  selected: boolean;
  label: string;
  kind: 'playing' | 'first5';
  onClick: () => void;
  disabled?: boolean;
}) {
  const baseClasses = selected
    ? 'border-emerald-600 bg-emerald-500 text-white'
    : 'border-amber-400 bg-amber-200 text-amber-950 hover:bg-amber-300';

  const displayLabel =
    kind === 'playing'
      ? selected
        ? 'Playing'
        : 'Absent'
      : selected
        ? 'Starter'
        : 'Add';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} ${selected ? 'selected' : 'not selected'}`}
      className={`flex h-7 w-14 items-center justify-center rounded-md border text-[11px] font-semibold transition-colors ${
        baseClasses
      } ${disabled ? 'cursor-not-allowed opacity-40 hover:bg-white' : ''}`}
    >
      {displayLabel}
    </button>
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
  const selectedFirstFive = playingPlayers.filter((p) => starterSet.has(p.id)).slice(0, 5);
  const headerBg = normalizeHex(teamColor) ?? teamColor;
  const headerFg = contrastTextOnBg(headerBg);

  return (
    <div className="flex min-w-0 flex-1 flex-col min-h-0">
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-gray-800">TEAM NAME</h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {side === 'home' ? (
          <TeamColorBlock side={side} color={teamColor} onChange={onTeamColorChange} />
        ) : null}

        <div className="min-w-0 flex-1 flex-col min-h-0">
          <div className="flex min-h-0 flex-1 flex-col h-[max(70dvh,360px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div
              className="grid items-center px-4 py-2.5"
              style={{
                gridTemplateColumns: '40px 1fr 72px 72px',
                backgroundColor: headerBg,
              }}
            >
              <span className="text-xs font-bold uppercase" style={{ color: headerFg }}>
                #
              </span>
              <span className="text-xs font-bold uppercase" style={{ color: headerFg }}>
                Player
              </span>
              <span
                className="pr-1 text-right text-[10px] font-bold uppercase"
                style={{ color: headerFg }}
              >
                Playing
              </span>
              <span
                className="pr-1 text-right text-[10px] font-bold uppercase"
                style={{ color: headerFg }}
              >
                First 5
              </span>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {MOCK_PLAYERS.map((player, index) => (
                <div
                  key={`${side}-row-${player.id}`}
                  className={`grid items-center px-4 py-2.5 ${index < ROWS - 1 ? 'border-b border-gray-100' : ''}`}
                  style={{ gridTemplateColumns: '40px 1fr 72px 72px' }}
                >
                  <span className="text-sm font-medium text-gray-700">{player.jersey}</span>

                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar />
                    <span className="text-sm font-medium text-gray-800">{player.name}</span>
                  </div>

                  <div className="flex justify-end pr-1">
                    <MainStyleStarterCheckbox
                      selected={playingSet.has(player.id)}
                      label="Playing"
                      kind="playing"
                      onClick={() => onTogglePlaying(player.id)}
                    />
                  </div>

                  <div className="flex justify-end pr-1">
                    <MainStyleStarterCheckbox
                      selected={starterSet.has(player.id)}
                      label="Selected"
                      kind="first5"
                      onClick={() => onToggle(player.id)}
                      disabled={!playingSet.has(player.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 shrink-0 rounded-md border border-gray-200 bg-white p-2">
            <p className="text-[10px] font-semibold uppercase text-gray-600">
              Players Playing ({playingPlayers.length}) {'->'} First 5 ({selectedFirstFive.length})
            </p>
            <p className="mt-1 text-xs text-gray-700">
              Playing: {playingPlayers.map((p) => `#${p.jersey}`).join(', ') || 'None'} | First 5:{' '}
              {selectedFirstFive.map((p) => `#${p.jersey}`).join(', ') || 'None'}
            </p>
          </div>
        </div>

        {side === 'away' ? (
          <TeamColorBlock side={side} color={teamColor} onChange={onTeamColorChange} />
        ) : null}
      </div>
    </div>
  );
}

const Starters: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { homeTeamColor, awayTeamColor, setHomeTeamColor, setAwayTeamColor } =
    useStatisticianTeamColors();
  const [homePlaying, setHomePlaying] = useState<Set<number>>(() => new Set(DEFAULT_PLAYING_ROWS));
  const [awayPlaying, setAwayPlaying] = useState<Set<number>>(() => new Set(DEFAULT_PLAYING_ROWS));
  const [homeStarters, setHomeStarters] = useState<Set<number>>(() => new Set(DEFAULT_STARTER_ROWS));
  const [awayStarters, setAwayStarters] = useState<Set<number>>(() => new Set(DEFAULT_STARTER_ROWS));
  const [firstFiveLimitModalOpen, setFirstFiveLimitModalOpen] = useState(false);
  const [firstFiveLimitSide, setFirstFiveLimitSide] = useState<TeamSide | null>(null);

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

      // Allow removing from the 5-man set.
      if (prev.has(i)) {
        const next = new Set(prev);
        next.delete(i);
        return next;
      }

      // Attempting to add a 6th player: block and show CTA modal.
      if (prev.size >= 5) {
        setFirstFiveLimitSide('home');
        setFirstFiveLimitModalOpen(true);
        return prev;
      }

      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }, [homePlaying]);

  const toggleAway = useCallback((i: number) => {
    setAwayStarters((prev) => {
      if (!awayPlaying.has(i)) return prev;

      if (prev.has(i)) {
        const next = new Set(prev);
        next.delete(i);
        return next;
      }

      if (prev.size >= 5) {
        setFirstFiveLimitSide('away');
        setFirstFiveLimitModalOpen(true);
        return prev;
      }

      const next = new Set(prev);
      next.add(i);
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

        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-20 pt-4">
          <div className="mx-auto grid h-full min-h-0 grid-cols-2 gap-6">
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

          {firstFiveLimitModalOpen && (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="first-five-limit-title"
            >
              <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
                <h2 id="first-five-limit-title" className="text-base font-bold text-gray-900">
                  First 5 is complete
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {firstFiveLimitSide === 'home'
                    ? 'Home already has 5 starters. Remove one to add another.'
                    : 'Away already has 5 starters. Remove one to add another.'}
                </p>
                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFirstFiveLimitModalOpen(false);
                      setFirstFiveLimitSide(null);
                    }}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default Starters;
