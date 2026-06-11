import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import {
  getContrastTextColor,
  isLightColor,
  normalizeHex,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
import type { TeamLineup } from '../statDash/substitutionLineupUtils';
import {
  mergeLineupPreserveExtraJerseys,
  startersSetsToTeamLineup,
  startersSetsToTeamLineupWithPlayers,
  STARTER_ROW_COUNT,
  teamLineupToStartersSets,
} from './startersLineupBridge';
import FirstFiveIncompleteModal from './FirstFiveIncompleteModal';
import { computeFirstFiveGate } from './startersFirstFiveGate';

const ROWS = STARTER_ROW_COUNT;
const STARTER_PLAYER_IMAGE = '/dplayer.png';
const DEFAULT_PLAYING_ROWS = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
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

type PlayerEntry = { jersey: number; name: string };

function TeamColumn({
  side,
  playingSet,
  starterSet,
  onTogglePlaying,
  onToggle,
  teamColor,
  onTeamColorChange,
  listScrollClassName,
  teamName,
  players,
}: {
  side: TeamSide;
  playingSet: Set<number>;
  starterSet: Set<number>;
  onTogglePlaying: (rowIndex: number) => void;
  onToggle: (rowIndex: number) => void;
  teamColor: string;
  onTeamColorChange: (hex: string) => void;
  listScrollClassName: string;
  teamName?: string;
  players?: PlayerEntry[];
}) {
  const indexedPlayers = useMemo(
    () => (players ?? MOCK_PLAYERS).map((p, i) => ({ id: i, jersey: p.jersey, name: p.name })),
    [players],
  );
  const playingPlayers = indexedPlayers.filter((p) => playingSet.has(p.id));
  const selectedFirstFive = playingPlayers.filter((p) => starterSet.has(p.id)).slice(0, 5);
  const headerBg = normalizeHex(teamColor) ?? teamColor;
  const headerFg = contrastTextOnBg(headerBg);
  const displayTeamName = teamName ?? (side === 'home' ? 'Home' : 'Away');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h2 className="mb-2 text-center text-sm font-bold uppercase tracking-widest text-gray-800 sm:mb-3">
        {displayTeamName}
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {side === 'home' ? (
          <TeamColorBlock side={side} color={teamColor} onChange={onTeamColorChange} />
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${listScrollClassName}`}
          >
            <div
              className="grid shrink-0 items-center px-4 py-2.5"
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
              <span className="pr-1 text-right text-[10px] font-bold uppercase" style={{ color: headerFg }}>
                Playing
              </span>
              <span className="pr-1 text-right text-[10px] font-bold uppercase" style={{ color: headerFg }}>
                First 5
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {indexedPlayers.map((player, index) => (
                <div
                  key={`${side}-row-${player.id}`}
                  className={`grid items-center px-4 py-2.5 ${index < indexedPlayers.length - 1 ? 'border-b border-gray-100' : ''}`}
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
              {displayTeamName} — Playing ({playingPlayers.length}) {'->'} First 5 ({selectedFirstFive.length})
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

export interface StartersFlowProps {
  variant?: 'page' | 'embedded';
  initialHomeLineup?: TeamLineup;
  initialAwayLineup?: TeamLineup;
  baselineHomeLineup?: TeamLineup;
  baselineAwayLineup?: TeamLineup;
  onApplyLineups?: (lineups: { home: TeamLineup; away: TeamLineup }) => void;
  onCancel?: () => void;
  homeName?: string;
  awayName?: string;
  homePlayers?: PlayerEntry[];
  awayPlayers?: PlayerEntry[];
}

export type StartersFlowHandle = {
  /** If lineups are complete, returns true (caller may navigate). Otherwise opens the reminder modal and returns false. */
  attemptContinue: () => boolean;
  /** Returns the computed lineups with real jersey numbers, or null if the first-five gate isn't ready. */
  getLineups: () => { home: TeamLineup; away: TeamLineup } | null;
};

const StartersFlow = forwardRef<StartersFlowHandle, StartersFlowProps>(function StartersFlow(
  {
    variant = 'page',
    initialHomeLineup,
    initialAwayLineup,
    baselineHomeLineup,
    baselineAwayLineup,
    onApplyLineups,
    onCancel,
    homeName,
    awayName,
    homePlayers,
    awayPlayers,
  },
  ref
) {
  const { homeTeamColor, awayTeamColor, setHomeTeamColor, setAwayTeamColor } =
    useStatisticianTeamColors();

  const initHome = useMemo(
    () =>
      initialHomeLineup
        ? teamLineupToStartersSets(initialHomeLineup)
        : { playing: DEFAULT_PLAYING_ROWS, starters: DEFAULT_STARTER_ROWS },
    [initialHomeLineup]
  );
  const initAway = useMemo(
    () =>
      initialAwayLineup
        ? teamLineupToStartersSets(initialAwayLineup)
        : { playing: DEFAULT_PLAYING_ROWS, starters: DEFAULT_STARTER_ROWS },
    [initialAwayLineup]
  );

  const [homePlaying, setHomePlaying] = useState<Set<number>>(() => new Set(initHome.playing));
  const [awayPlaying, setAwayPlaying] = useState<Set<number>>(() => new Set(initAway.playing));
  const [homeStarters, setHomeStarters] = useState<Set<number>>(() => new Set(initHome.starters));
  const [awayStarters, setAwayStarters] = useState<Set<number>>(() => new Set(initAway.starters));
  const [firstFiveLimitModalOpen, setFirstFiveLimitModalOpen] = useState(false);
  const [firstFiveLimitSide, setFirstFiveLimitSide] = useState<TeamSide | null>(null);
  const [incompleteFirstFiveModalOpen, setIncompleteFirstFiveModalOpen] = useState(false);

  // Lift indexedPlayers to component level so getLineups() can use real jersey numbers.
  const homeIndexedPlayers = useMemo(
    () => (homePlayers ?? MOCK_PLAYERS).map((p, i) => ({ id: i, jersey: p.jersey })),
    [homePlayers],
  );
  const awayIndexedPlayers = useMemo(
    () => (awayPlayers ?? MOCK_PLAYERS).map((p, i) => ({ id: i, jersey: p.jersey })),
    [awayPlayers],
  );

  const listScrollClassName =
    variant === 'embedded' ? 'max-h-[min(380px,44dvh)]' : 'h-[max(70dvh,360px)]';

  const firstFiveGate = useMemo(
    () => computeFirstFiveGate(homePlaying, homeStarters, awayPlaying, awayStarters),
    [awayPlaying, awayStarters, homePlaying, homeStarters]
  );

  useImperativeHandle(
    ref,
    () => ({
      attemptContinue: () => {
        const gate = computeFirstFiveGate(homePlaying, homeStarters, awayPlaying, awayStarters);
        if (gate.ready) return true;
        setIncompleteFirstFiveModalOpen(true);
        return false;
      },
      getLineups: () => {
        const gate = computeFirstFiveGate(homePlaying, homeStarters, awayPlaying, awayStarters);
        if (!gate.ready) return null;
        const homeUi = startersSetsToTeamLineupWithPlayers(homeIndexedPlayers, homePlaying, homeStarters);
        const awayUi = startersSetsToTeamLineupWithPlayers(awayIndexedPlayers, awayPlaying, awayStarters);
        const baseH = baselineHomeLineup ?? homeUi;
        const baseA = baselineAwayLineup ?? awayUi;
        return {
          home: mergeLineupPreserveExtraJerseys(baseH, homeUi),
          away: mergeLineupPreserveExtraJerseys(baseA, awayUi),
        };
      },
    }),
    [awayIndexedPlayers, awayPlaying, awayStarters, baselineAwayLineup, baselineHomeLineup, homeIndexedPlayers, homePlaying, homeStarters]
  );

  const toggleHome = useCallback(
    (i: number) => {
      setHomeStarters((prev) => {
        if (!homePlaying.has(i)) return prev;
        if (prev.has(i)) {
          const next = new Set(prev);
          next.delete(i);
          return next;
        }
        if (prev.size >= 5) {
          setFirstFiveLimitSide('home');
          setFirstFiveLimitModalOpen(true);
          return prev;
        }
        const next = new Set(prev);
        next.add(i);
        return next;
      });
    },
    [homePlaying]
  );

  const toggleAway = useCallback(
    (i: number) => {
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
    },
    [awayPlaying]
  );

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

  const handleApply = useCallback(() => {
    if (!onApplyLineups) return;
    if (!firstFiveGate.ready) {
      setIncompleteFirstFiveModalOpen(true);
      return;
    }
    const homeUi = startersSetsToTeamLineupWithPlayers(homeIndexedPlayers, homePlaying, homeStarters);
    const awayUi = startersSetsToTeamLineupWithPlayers(awayIndexedPlayers, awayPlaying, awayStarters);
    const baseH = baselineHomeLineup ?? homeUi;
    const baseA = baselineAwayLineup ?? awayUi;
    onApplyLineups({
      home: mergeLineupPreserveExtraJerseys(baseH, homeUi),
      away: mergeLineupPreserveExtraJerseys(baseA, awayUi),
    });
  }, [
    awayIndexedPlayers,
    awayPlaying,
    awayStarters,
    baselineAwayLineup,
    baselineHomeLineup,
    firstFiveGate.ready,
    homeIndexedPlayers,
    homePlaying,
    homeStarters,
    onApplyLineups,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col font-sans">
      <div
        className={`mx-auto grid min-h-0 w-full max-w-6xl gap-4 sm:gap-6 ${
          variant === 'embedded' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2'
        }`}
      >
        <TeamColumn
          side="home"
          playingSet={homePlaying}
          starterSet={homeStarters}
          onTogglePlaying={toggleHomePlaying}
          onToggle={toggleHome}
          teamColor={homeTeamColor}
          onTeamColorChange={setHomeTeamColor}
          listScrollClassName={listScrollClassName}
          teamName={homeName}
          players={homePlayers}
        />
        <TeamColumn
          side="away"
          playingSet={awayPlaying}
          starterSet={awayStarters}
          onTogglePlaying={toggleAwayPlaying}
          onToggle={toggleAway}
          teamColor={awayTeamColor}
          onTeamColorChange={setAwayTeamColor}
          listScrollClassName={listScrollClassName}
          teamName={awayName}
          players={awayPlayers}
        />
      </div>

      {onApplyLineups && onCancel && (
        <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Apply
          </button>
        </div>
      )}

      <FirstFiveIncompleteModal
        open={incompleteFirstFiveModalOpen}
        onClose={() => setIncompleteFirstFiveModalOpen(false)}
        issues={firstFiveGate.issues}
      />

      {firstFiveLimitModalOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
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
  );
});

export default StartersFlow;
