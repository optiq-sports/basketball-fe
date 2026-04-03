import React from 'react';
import { FiArrowRight, FiX } from 'react-icons/fi';
import { jerseyAccentSurfaceStyle } from '../../../contexts/StatisticianTeamColorsContext';
import type { TeamLineup } from '../substitutionLineupUtils';
import {
  LINEUP_SLOTS,
  lineupIsComplete,
  moveBenchToFirstEmptySlot,
  moveSlotToBench,
} from '../substitutionLineupUtils';

export interface SubstitutionModalProps {
  open: boolean;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  draftHome: TeamLineup;
  draftAway: TeamLineup;
  onChangeHome: (lineup: TeamLineup) => void;
  onChangeAway: (lineup: TeamLineup) => void;
  onFinish: () => void;
  onCancel: () => void;
}

function TeamColumn({
  teamName,
  badgeColor,
  lineup,
  onChange,
}: {
  teamName: string;
  badgeColor: string;
  lineup: TeamLineup;
  onChange: (next: TeamLineup) => void;
}) {
  const onSlotClick = (slotIndex: number) => {
    onChange(moveSlotToBench(lineup, slotIndex));
  };

  const onBenchClick = (benchIndex: number) => {
    onChange(moveBenchToFirstEmptySlot(lineup, benchIndex));
  };

  const onClearOnCourt = () => {
    const currentOnCourt = lineup.onCourt.filter((j): j is number => j !== null);
    if (currentOnCourt.length === 0) return;
    onChange({
      onCourt: [null, null, null, null, null],
      bench: [...lineup.bench, ...currentOnCourt],
    });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 border-gray-200 px-2 sm:px-3">
      <div
        className="mx-auto w-full max-w-[140px] rounded-md px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide sm:text-[11px]"
        style={jerseyAccentSurfaceStyle(badgeColor)}
      >
        {teamName}
      </div>

      <div className="flex flex-col items-start gap-1">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase text-gray-600">Players On</span>
          <button
            type="button"
            onClick={onClearOnCourt}
            disabled={lineup.onCourt.every((j) => j === null)}
            className="rounded border border-gray-300 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-1">
          {Array.from({ length: LINEUP_SLOTS }, (_, i) => {
            const j = lineup.onCourt[i];
            return (
              <button
                key={`slot-${i}`}
                type="button"
                onClick={() => onSlotClick(i)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border text-xs font-bold sm:h-10 sm:w-10 sm:text-sm ${
                  j === null
                    ? 'border-dashed border-gray-400 bg-gray-200 text-gray-500'
                    : 'border-gray-400 bg-gray-300 text-gray-900 hover:bg-gray-400/80'
                }`}
                aria-label={j === null ? `Empty slot ${i + 1}` : `On court #${j}, move to bench`}
              >
                {j ?? ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-start gap-1">
        <span className="text-[9px] font-semibold uppercase text-gray-600">Bench</span>
        <div className="flex w-full flex-wrap justify-center gap-1">
          {lineup.bench.map((j, benchIdx) => (
            <button
              key={`bench-${j}-${benchIdx}`}
              type="button"
              onClick={() => onBenchClick(benchIdx)}
              disabled={!lineup.onCourt.some((x) => x === null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-gray-900 bg-white text-xs font-bold text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10 sm:text-sm"
              aria-label={`Bench #${j}, move to open court slot`}
            >
              {j}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  open,
  homeName,
  awayName,
  homeColor,
  awayColor,
  draftHome,
  draftAway,
  onChangeHome,
  onChangeAway,
  onFinish,
  onCancel,
}) => {
  if (!open) return null;

  const canFinish = lineupIsComplete(draftHome) && lineupIsComplete(draftAway);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      <div className="shrink-0 border-b border-gray-200 px-3 py-2 sm:px-4 sm:py-3">
        <h2
          id="sub-modal-title"
          className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm"
        >
          Substitution
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 sm:py-3">
        <div className="flex divide-x divide-gray-300">
          <TeamColumn
            teamName={homeName}
            badgeColor={homeColor}
            lineup={draftHome}
            onChange={onChangeHome}
          />
          <TeamColumn
            teamName={awayName}
            badgeColor={awayColor}
            lineup={draftAway}
            onChange={onChangeAway}
          />
        </div>
        {!canFinish && (
          <p className="mt-2 px-3 text-center text-[10px] text-amber-800 sm:text-[11px]">
            Each team needs 5 players on the court to finish.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-stretch justify-between border-t border-gray-200 bg-sky-100/80 px-2 py-2.5 sm:px-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-col items-center gap-0.5 rounded px-2 py-0.5 text-gray-900 hover:bg-sky-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <FiX size={16} strokeWidth={2.2} aria-hidden />
          <span className="text-[11px] font-medium">Cancel</span>
        </button>
        <button
          type="button"
          disabled={!canFinish}
          onClick={onFinish}
          className="flex flex-col items-center gap-0.5 rounded px-2 py-0.5 text-gray-900 hover:bg-sky-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiArrowRight size={16} strokeWidth={2.2} aria-hidden />
          <span className="text-[11px] font-medium">Finish</span>
        </button>
      </div>
    </div>
  );
};

export default SubstitutionModal;
