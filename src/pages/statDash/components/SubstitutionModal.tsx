import React from 'react';
import { FiArrowRight, FiX } from 'react-icons/fi';
import {
  getContrastTextColor,
  jerseyAccentSurfaceStyle,
  normalizeHex,
} from '../../../contexts/StatisticianTeamColorsContext';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';
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
  const normalizedAccent = normalizeHex(badgeColor) ?? badgeColor;
  const onCourtText = getContrastTextColor(normalizedAccent);

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
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
      <div
        className="mx-auto w-full max-w-[180px] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide"
        style={jerseyAccentSurfaceStyle(badgeColor)}
      >
        {teamName}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex w-full max-w-[300px] items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Players On</span>
          <button
            type="button"
            onClick={onClearOnCourt}
            disabled={lineup.onCourt.every((j) => j === null)}
            className="border border-gray-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: LINEUP_SLOTS }, (_, i) => {
            const j = lineup.onCourt[i];
            const empty = j === null;
            return (
              <button
                key={`slot-${i}`}
                type="button"
                onClick={() => onSlotClick(i)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center border font-bold leading-none transition-all sm:h-14 sm:w-14 ${
                  empty
                    ? 'border-dashed border-gray-300 bg-gray-50 text-gray-300'
                    : 'border-transparent shadow-sm hover:brightness-110'
                }`}
                style={{
                  fontFamily: GATEWAY_DISPLAY_FONT_STACK,
                  fontSize: 'clamp(16px, 1.6vw, 20px)',
                  ...(empty ? {} : { background: normalizedAccent, color: onCourtText }),
                }}
                aria-label={empty ? `Empty slot ${i + 1}` : `On court #${j}, move to bench`}
              >
                {j ?? ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="w-full max-w-[300px] text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Bench
        </span>
        <div className="flex min-h-[3rem] w-full max-w-[300px] flex-wrap justify-center gap-2 sm:min-h-[3.5rem]">
          {lineup.bench.length === 0 && (
            <span className="pt-2 text-[11px] text-gray-300">No bench players</span>
          )}
          {lineup.bench.map((j, benchIdx) => (
            <button
              key={`bench-${j}-${benchIdx}`}
              type="button"
              onClick={() => onBenchClick(benchIdx)}
              disabled={!lineup.onCourt.some((x) => x === null)}
              className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-gray-800 bg-white font-bold leading-none text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-14 sm:w-14"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 'clamp(16px, 1.6vw, 20px)' }}
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
      className="flex max-h-full w-full flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      <div className="shrink-0 border-b border-gray-200 bg-gray-900 px-4 py-3 sm:px-6">
        <h2
          id="sub-modal-title"
          className="text-left text-white"
          style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 20, letterSpacing: 1 }}
        >
          Substitution
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex divide-x divide-gray-200">
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
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
            Each team needs 5 players on the court to finish.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <FiX size={16} strokeWidth={2.2} aria-hidden />
          Cancel
        </button>
        <button
          type="button"
          disabled={!canFinish}
          onClick={onFinish}
          className="flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Finish
          <FiArrowRight size={16} strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
};

export default SubstitutionModal;
