import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { FiCheck, FiStar } from "react-icons/fi";
import {
  getContrastTextColor,
  isLightColor,
  normalizeHex,
  useStatisticianTeamColors,
} from "../../contexts/StatisticianTeamColorsContext";
import type { TeamLineup } from "../statDash/substitutionLineupUtils";
import {
  mergeLineupPreserveExtraJerseys,
  startersSetsToTeamLineup,
  startersSetsToTeamLineupWithPlayers,
  STARTER_ROW_COUNT,
  teamLineupToStartersSets,
} from "./startersLineupBridge";
import FirstFiveIncompleteModal from "./FirstFiveIncompleteModal";
import { computeFirstFiveGate } from "./startersFirstFiveGate";
import {
  GATEWAY_DISPLAY_FONT_STACK,
  GATEWAY_FONT_STACK,
} from "../../authGatewayTheme";

const ROWS = STARTER_ROW_COUNT;
const DEFAULT_PLAYING_ROWS = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
const DEFAULT_STARTER_ROWS = new Set([0, 1, 2, 3, 6]);
const MOCK_PLAYERS = Array.from({ length: ROWS }, (_, index) => ({
  id: index,
  jersey: index + 1,
  name: `Player ${index + 1}`,
}));

type TeamSide = "home" | "away";

function contrastTextOnBg(hex: string): string {
  return getContrastTextColor(hex);
}

const TEAM_SWATCHES = [
  "#FFFFFF",
  "#EF4444",
  "#DC2626",
  "#2563EB",
  "#1D4ED8",
  "#0EA5E9",
  "#16A34A",
  "#EAB308",
  "#F97316",
  "#A855F7",
  "#DB2777",
  "#111827",
  "#4B5563",
] as const;

function TeamColorBlock({
  side,
  color,
  onChange,
  takenColor,
}: {
  side: TeamSide;
  color: string;
  onChange: (hex: string) => void;
  /** The other team's current color, normalized — unavailable here so the two teams can never match. */
  takenColor?: string | null;
}) {
  const normalized = normalizeHex(color) ?? color;
  const fg = useMemo(() => contrastTextOnBg(normalized), [normalized]);

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.25)] sm:w-[192px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Jersey color
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-xs font-bold tracking-wider"
          style={{
            backgroundColor: normalized,
            color: fg,
            boxShadow: isLightColor(normalized)
              ? "inset 0 0 0 1px rgba(17,24,39,0.15)"
              : undefined,
          }}
        >
          00
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {TEAM_SWATCHES.map((swatch) => {
          const isTaken = takenColor != null && swatch === takenColor;
          return (
            <button
              key={`${side}-${swatch}`}
              type="button"
              onClick={() => onChange(swatch)}
              disabled={isTaken}
              className={`relative aspect-square rounded-md transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isTaken
                  ? "cursor-not-allowed opacity-30"
                  : "hover:scale-110"
              } ${
                normalizeHex(color) === swatch
                  ? "ring-2 ring-offset-1 ring-gray-900"
                  : ""
              }`}
              style={{
                backgroundColor: swatch,
                boxShadow: isLightColor(swatch)
                  ? "inset 0 0 0 1px rgba(17,24,39,0.15)"
                  : undefined,
              }}
              aria-label={
                isTaken
                  ? `${swatch} is already the other team's color`
                  : `${side === "home" ? "Home" : "Away"} team color ${swatch}`
              }
              title={isTaken ? "Already used by the other team" : undefined}
            >
              {isTaken && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md"
                  style={{
                    background:
                      'linear-gradient(to top right, transparent calc(50% - 1px), rgba(17,24,39,0.7) calc(50% - 1px), rgba(17,24,39,0.7) calc(50% + 1px), transparent calc(50% + 1px))',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A jersey number patch, standing in for both the "#" column and a player avatar — more
 * authentic to an actual roster sheet than a generic initials circle. */
function JerseyBadge({
  jersey,
  accentColor,
}: {
  jersey: number;
  accentColor: string;
}) {
  const normalized = normalizeHex(accentColor) ?? "#3B82F6";
  const safe = isLightColor(normalized) ? "#334155" : normalized;
  const fg = getContrastTextColor(safe);
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base leading-none"
      style={{
        backgroundColor: safe,
        color: fg,
        fontFamily: GATEWAY_DISPLAY_FONT_STACK,
        boxShadow: `0 2px 6px -2px ${safe}99`,
      }}
      aria-hidden
    >
      {jersey}
    </div>
  );
}

/**
 * Scoresheet-style check tile — a statistician "checking off" a player, not a generic status
 * pill. Empty outline = not marked; filled square + icon = marked. No text label needed since
 * the column header ("Playing" / "First 5") already says what's being checked.
 */
function CheckTile({
  selected,
  kind,
  onClick,
  disabled = false,
}: {
  selected: boolean;
  kind: "playing" | "first5";
  onClick: () => void;
  disabled?: boolean;
}) {
  const activeColor = kind === "playing" ? "#059669" : "#0284C7";
  const label =
    kind === "playing"
      ? selected
        ? "Playing — tap to mark absent"
        : "Absent — tap to mark playing"
      : selected
        ? "Starter — tap to remove from first five"
        : "Tap to add to first five";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md border-[1.5px] transition-all ${
        disabled
          ? "cursor-not-allowed border-gray-100 bg-gray-50"
          : "hover:scale-105"
      }`}
      style={
        selected
          ? {
              backgroundColor: activeColor,
              borderColor: activeColor,
              boxShadow: `0 3px 8px -3px ${activeColor}99`,
            }
          : disabled
            ? undefined
            : { borderColor: "#D1D5DB", backgroundColor: "#FFFFFF" }
      }
    >
      {kind === "playing" ? (
        <FiCheck
          size={16}
          strokeWidth={3}
          color={selected ? "#FFFFFF" : "#CBD5E1"}
        />
      ) : (
        <FiStar
          size={14}
          strokeWidth={selected ? 0 : 2}
          fill={selected ? "#FFFFFF" : "none"}
          color={selected ? "#FFFFFF" : "#CBD5E1"}
        />
      )}
    </button>
  );
}

export type PlayerEntry = { jersey: number; name: string };

function TeamColumn({
  side,
  playingSet,
  starterSet,
  onTogglePlaying,
  onToggle,
  teamColor,
  onTeamColorChange,
  otherTeamColor,
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
  otherTeamColor: string;
  listScrollClassName: string;
  teamName?: string;
  players?: PlayerEntry[];
}) {
  const indexedPlayers = useMemo(
    () =>
      (players ?? MOCK_PLAYERS).map((p, i) => ({
        id: i,
        jersey: p.jersey,
        name: p.name,
      })),
    [players],
  );
  const playingPlayers = indexedPlayers.filter((p) => playingSet.has(p.id));
  const selectedFirstFive = playingPlayers
    .filter((p) => starterSet.has(p.id))
    .slice(0, 5);
  const displayTeamName = teamName ?? (side === "home" ? "Home" : "Away");
  const normalizedColor = normalizeHex(teamColor) ?? teamColor;
  const ready = selectedFirstFive.length === 5;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: normalizedColor,
              boxShadow: isLightColor(normalizedColor)
                ? "inset 0 0 0 1px rgba(17,24,39,0.25)"
                : undefined,
            }}
            aria-hidden
          />
          <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
            {displayTeamName}
          </h2>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-md py-1 pl-2 pr-2.5 transition-colors"
          style={{ backgroundColor: ready ? "#059669" : "#1F2937" }}
        >
          {ready ? (
            <FiCheck size={12} strokeWidth={3} color="#FFFFFF" />
          ) : (
            <span
              className="text-xs font-bold tabular-nums text-white"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK }}
            >
              {selectedFirstFive.length}/5
            </span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-wider text-white">
            {ready ? "First five ready" : "First five"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {side === "home" ? (
          <TeamColorBlock
            side={side}
            color={teamColor}
            onChange={onTeamColorChange}
            takenColor={normalizeHex(otherTeamColor) ?? otherTeamColor}
          />
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl border border-gray-200 bg-white ${listScrollClassName}`}
            style={{
              boxShadow: `0 16px 32px -16px ${normalizedColor}4D, 0 2px 8px rgba(15,23,42,0.06)`,
            }}
          >
            <div
              className="h-1 w-full shrink-0"
              style={{ backgroundColor: normalizedColor }}
              aria-hidden
            />
            <div
              className="grid shrink-0 items-center border-b border-gray-100 bg-gray-50/70 px-4 py-2.5"
              style={{ gridTemplateColumns: "1fr 44px 44px" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Player
              </span>
              <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Play
              </span>
              <span className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                First 5
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {indexedPlayers.map((player, index) => (
                <div
                  key={`${side}-row-${player.id}`}
                  className={`grid items-center gap-2 px-4 py-2 transition-colors hover:bg-gray-50/70 ${
                    index < indexedPlayers.length - 1
                      ? "border-b border-gray-50"
                      : ""
                  }`}
                  style={{ gridTemplateColumns: "1fr 44px 44px" }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <JerseyBadge
                      jersey={player.jersey}
                      accentColor={teamColor}
                    />
                    <span
                      className="truncate text-sm font-medium text-gray-800"
                      title={player.name}
                    >
                      {player.name}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <CheckTile
                      selected={playingSet.has(player.id)}
                      kind="playing"
                      onClick={() => onTogglePlaying(player.id)}
                    />
                  </div>

                  <div className="flex justify-center">
                    <CheckTile
                      selected={starterSet.has(player.id)}
                      kind="first5"
                      onClick={() => onToggle(player.id)}
                      disabled={!playingSet.has(player.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {side === "away" ? (
          <TeamColorBlock
            side={side}
            color={teamColor}
            onChange={onTeamColorChange}
            takenColor={normalizeHex(otherTeamColor) ?? otherTeamColor}
          />
        ) : null}
      </div>
    </div>
  );
}

export interface StartersFlowProps {
  variant?: "page" | "embedded";
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

const StartersFlow = forwardRef<StartersFlowHandle, StartersFlowProps>(
  function StartersFlow(
    {
      variant = "page",
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
    ref,
  ) {
    const { homeTeamColor, awayTeamColor, setHomeTeamColor, setAwayTeamColor } =
      useStatisticianTeamColors();

    const initHome = useMemo(
      () =>
        initialHomeLineup
          ? teamLineupToStartersSets(initialHomeLineup)
          : { playing: DEFAULT_PLAYING_ROWS, starters: DEFAULT_STARTER_ROWS },
      [initialHomeLineup],
    );
    const initAway = useMemo(
      () =>
        initialAwayLineup
          ? teamLineupToStartersSets(initialAwayLineup)
          : { playing: DEFAULT_PLAYING_ROWS, starters: DEFAULT_STARTER_ROWS },
      [initialAwayLineup],
    );

    const [homePlaying, setHomePlaying] = useState<Set<number>>(
      () => new Set(initHome.playing),
    );
    const [awayPlaying, setAwayPlaying] = useState<Set<number>>(
      () => new Set(initAway.playing),
    );
    const [homeStarters, setHomeStarters] = useState<Set<number>>(
      () => new Set(initHome.starters),
    );
    const [awayStarters, setAwayStarters] = useState<Set<number>>(
      () => new Set(initAway.starters),
    );
    const [firstFiveLimitModalOpen, setFirstFiveLimitModalOpen] =
      useState(false);
    const [firstFiveLimitSide, setFirstFiveLimitSide] =
      useState<TeamSide | null>(null);
    const [incompleteFirstFiveModalOpen, setIncompleteFirstFiveModalOpen] =
      useState(false);

    // Lift indexedPlayers to component level so getLineups() can use real jersey numbers.
    const homeIndexedPlayers = useMemo(
      () =>
        (homePlayers ?? MOCK_PLAYERS).map((p, i) => ({
          id: i,
          jersey: p.jersey,
        })),
      [homePlayers],
    );
    const awayIndexedPlayers = useMemo(
      () =>
        (awayPlayers ?? MOCK_PLAYERS).map((p, i) => ({
          id: i,
          jersey: p.jersey,
        })),
      [awayPlayers],
    );

    const listScrollClassName =
      variant === "embedded"
        ? "max-h-[min(380px,44dvh)]"
        : "h-[max(70dvh,360px)]";

    const firstFiveGate = useMemo(
      () =>
        computeFirstFiveGate(
          homePlaying,
          homeStarters,
          awayPlaying,
          awayStarters,
        ),
      [awayPlaying, awayStarters, homePlaying, homeStarters],
    );

    useImperativeHandle(
      ref,
      () => ({
        attemptContinue: () => {
          const gate = computeFirstFiveGate(
            homePlaying,
            homeStarters,
            awayPlaying,
            awayStarters,
          );
          if (gate.ready) return true;
          setIncompleteFirstFiveModalOpen(true);
          return false;
        },
        getLineups: () => {
          const gate = computeFirstFiveGate(
            homePlaying,
            homeStarters,
            awayPlaying,
            awayStarters,
          );
          if (!gate.ready) return null;
          const homeUi = startersSetsToTeamLineupWithPlayers(
            homeIndexedPlayers,
            homePlaying,
            homeStarters,
          );
          const awayUi = startersSetsToTeamLineupWithPlayers(
            awayIndexedPlayers,
            awayPlaying,
            awayStarters,
          );
          const baseH = baselineHomeLineup ?? homeUi;
          const baseA = baselineAwayLineup ?? awayUi;
          return {
            home: mergeLineupPreserveExtraJerseys(baseH, homeUi),
            away: mergeLineupPreserveExtraJerseys(baseA, awayUi),
          };
        },
      }),
      [
        awayIndexedPlayers,
        awayPlaying,
        awayStarters,
        baselineAwayLineup,
        baselineHomeLineup,
        homeIndexedPlayers,
        homePlaying,
        homeStarters,
      ],
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
            setFirstFiveLimitSide("home");
            setFirstFiveLimitModalOpen(true);
            return prev;
          }
          const next = new Set(prev);
          next.add(i);
          return next;
        });
      },
      [homePlaying],
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
            setFirstFiveLimitSide("away");
            setFirstFiveLimitModalOpen(true);
            return prev;
          }
          const next = new Set(prev);
          next.add(i);
          return next;
        });
      },
      [awayPlaying],
    );

    const toggleHomePlaying = useCallback((i: number) => {
      setHomePlaying((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        setHomeStarters(
          (starters) =>
            new Set(
              Array.from(starters)
                .filter((id) => next.has(id))
                .slice(0, 5),
            ),
        );
        return next;
      });
    }, []);

    const toggleAwayPlaying = useCallback((i: number) => {
      setAwayPlaying((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        setAwayStarters(
          (starters) =>
            new Set(
              Array.from(starters)
                .filter((id) => next.has(id))
                .slice(0, 5),
            ),
        );
        return next;
      });
    }, []);

    const handleApply = useCallback(() => {
      if (!onApplyLineups) return;
      if (!firstFiveGate.ready) {
        setIncompleteFirstFiveModalOpen(true);
        return;
      }
      const homeUi = startersSetsToTeamLineupWithPlayers(
        homeIndexedPlayers,
        homePlaying,
        homeStarters,
      );
      const awayUi = startersSetsToTeamLineupWithPlayers(
        awayIndexedPlayers,
        awayPlaying,
        awayStarters,
      );
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
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ fontFamily: GATEWAY_FONT_STACK }}
      >
        <div
          className={`mx-auto grid min-h-0 w-full max-w-6xl grid-cols-1 gap-4 sm:gap-6 ${
            variant === "embedded" ? "lg:grid-cols-2" : "md:grid-cols-2"
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
            otherTeamColor={awayTeamColor}
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
            otherTeamColor={homeTeamColor}
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
              className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 active:scale-[0.98]"
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
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
              <h2
                id="first-five-limit-title"
                className="text-base font-bold text-gray-900"
              >
                First 5 is complete
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {firstFiveLimitSide === "home"
                  ? "Home already has 5 starters. Remove one to add another."
                  : "Away already has 5 starters. Remove one to add another."}
              </p>
              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFirstFiveLimitModalOpen(false);
                    setFirstFiveLimitSide(null);
                  }}
                  className="rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default StartersFlow;
