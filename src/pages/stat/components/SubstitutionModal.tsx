import React, { useState } from 'react';
import { FiX, FiArrowRight } from 'react-icons/fi';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface SubEvent {
  team: 1 | 2;
  playerOut: number;
  playerIn: number;
}

interface TeamRoster {
  court: (number | null)[];   // null = empty slot (player pulled off waiting for replacement)
  bench: number[];
}

interface Props {
  team1Color: string;
  team2Color: string;
  team1Name: string;
  team2Name: string;
  onFinish: (subs: SubEvent[]) => void;
  onCancel: () => void;
}

// ─── Initial mock rosters ──────────────────────────────────────────────────────
const INIT_COURT = [1, 2, 3, 4, 5];
const INIT_BENCH = [15, 10, 16, 11, 8, 9, 30, 23];

// ─── SubstitutionModal ─────────────────────────────────────────────────────────
const SubstitutionModal: React.FC<Props> = ({
  team1Color,
  team2Color,
  team1Name,
  team2Name,
  onFinish,
  onCancel,
}) => {
  const [t1, setT1] = useState<TeamRoster>({
    court: [...INIT_COURT],
    bench: [...INIT_BENCH],
  });
  const [t2, setT2] = useState<TeamRoster>({
    court: [...INIT_COURT],
    bench: [...INIT_BENCH],
  });
  // Track the player that was pulled off (for logging)
  const [pendingOut, setPendingOut] = useState<{ team: 1 | 2; num: number } | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);

  const rosterOf = (team: 1 | 2) => (team === 1 ? t1 : t2);
  const setRosterOf = (team: 1 | 2) => (team === 1 ? setT1 : setT2);

  // Click a "Players On" tile → pull them off (creates null slot, player moves to bench)
  const handleCourtClick = (team: 1 | 2, num: number) => {
    const roster = rosterOf(team);
    if (roster.court.includes(null)) return;           // already one pending – finish that first
    if (pendingOut?.team === team) return;             // same team already has one pending
    setRosterOf(team)((prev) => ({
      court: prev.court.map((n) => (n === num ? null : n)),
      bench: [...prev.bench, num],
    }));
    setPendingOut({ team, num });
  };

  // Click a bench tile → fill the null slot for that team
  const handleBenchClick = (team: 1 | 2, num: number) => {
    if (!pendingOut || pendingOut.team !== team) return;
    setRosterOf(team)((prev) => ({
      court: prev.court.map((n) => (n === null ? num : n)),
      bench: prev.bench.filter((n) => n !== num),
    }));
    setSubEvents((prev) => [
      ...prev,
      { team, playerOut: pendingOut.num, playerIn: num },
    ]);
    setPendingOut(null);
  };

  const handleFinish = () => onFinish(subEvents);

  // ─── Tile subcomponents ───────────────────────────────────────────────────────
  const CourtTile = ({
    num,
    team,
  }: {
    num: number | null;
    team: 1 | 2;
  }) => {
    if (num === null) {
      // Empty slot – dashed placeholder
      return (
        <div className="w-12 h-12 rounded border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
          <span className="text-gray-300 text-lg font-bold">·</span>
        </div>
      );
    }
    const isLeaving = pendingOut?.team === team && pendingOut?.num === num;
    // If this player is already the pending-out but hasn't been swapped yet they'd be on bench, not here.
    // (isLeaving would be false normally because they're moved immediately)
    return (
      <button
        onClick={() => handleCourtClick(team, num)}
        disabled={rosterOf(team).court.includes(null)}
        className={`w-12 h-12 rounded text-lg font-bold transition-all flex items-center justify-center
          ${rosterOf(team).court.includes(null)
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-300 text-gray-800 hover:bg-gray-400 active:scale-95 cursor-pointer'
          } ${isLeaving ? 'opacity-40' : ''}`}
      >
        {num}
      </button>
    );
  };

  const BenchTile = ({ num, team }: { num: number; team: 1 | 2 }) => {
    const hasSlot = rosterOf(team).court.includes(null) && pendingOut?.team === team;
    return (
      <button
        onClick={() => handleBenchClick(team, num)}
        disabled={!hasSlot}
        className={`w-12 h-12 rounded border-2 text-lg font-bold transition-all flex items-center justify-center
          ${hasSlot
            ? 'border-gray-800 text-gray-800 bg-white hover:bg-gray-100 active:scale-95 cursor-pointer ring-2 ring-offset-1 ring-blue-400'
            : 'border-gray-400 text-gray-500 bg-white cursor-default'
          }`}
      >
        {num}
      </button>
    );
  };

  // ─── Team panel ───────────────────────────────────────────────────────────────
  const TeamPanel = ({
    team,
    color,
    name,
    roster,
    mirrored,
  }: {
    team: 1 | 2;
    color: string;
    name: string;
    roster: TeamRoster;
    mirrored: boolean;
  }) => {
    // Bench tiles in rows of 5
    const benchRows: number[][] = [];
    for (let i = 0; i < roster.bench.length; i += 5) {
      benchRows.push(roster.bench.slice(i, i + 5));
    }

    return (
      <div className={`flex-1 px-6 py-4 flex flex-col gap-4 ${mirrored ? 'items-end' : 'items-start'}`}>
        {/* Team colour pill */}
        <span
          className="px-4 py-1 text-white text-xs font-bold rounded-sm tracking-widest"
          style={{ backgroundColor: color }}
        >
          {name}
        </span>

        {/* Players On row */}
        <div className={`flex items-center gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs text-gray-500 font-semibold w-20 shrink-0 text-right">
            Players On
          </span>
          <div className="flex gap-2">
            {roster.court.map((num, i) => (
              <CourtTile key={i} num={num} team={team} />
            ))}
          </div>
        </div>

        {/* Bench rows */}
        <div className={`flex items-start gap-3 ${mirrored ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs text-gray-500 font-semibold w-20 shrink-0 text-right pt-1">
            Bench
          </span>
          <div className="flex flex-col gap-2">
            {benchRows.map((row, ri) => (
              <div key={ri} className="flex gap-2">
                {row.map((num) => (
                  <BenchTile key={num} num={num} team={team} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[950] bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 shadow-2xl overflow-hidden">
        {/* Title */}
        <div className="px-7 pt-5 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
            Substitution
          </p>
        </div>

        {/* Body: two panels + vertical divider */}
        <div className="flex items-stretch">
          <TeamPanel
            team={1}
            color={team1Color}
            name={team1Name}
            roster={t1}
            mirrored={false}
          />
          <div className="w-px bg-gray-200 my-4" />
          <TeamPanel
            team={2}
            color={team2Color}
            name={team2Name}
            roster={t2}
            mirrored={true}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-7 py-3 flex justify-between items-center">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors font-semibold"
          >
            <FiX size={13} />
            Cancel
          </button>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors font-semibold"
          >
            Finish
            <FiArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubstitutionModal;
