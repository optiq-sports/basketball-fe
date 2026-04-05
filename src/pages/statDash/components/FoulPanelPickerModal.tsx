import React, { useMemo } from 'react';
import { FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import { jerseyAccentSurfaceStyle } from '../../../contexts/StatisticianTeamColorsContext';
import type { PanelFoulPick } from '../foulRecordingUtils';
import { STAT_DASH } from '../statDashTheme';

export interface FoulPanelPickerModalProps {
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeBench: number[];
  awayBench: number[];
  onPick: (side: TeamSide, pick: PanelFoulPick) => void;
  onCancel: () => void;
}

function PanelFooter({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex shrink-0 items-stretch border-t border-gray-200 bg-sky-100/80 px-2 py-2.5 sm:px-3">
      <div className="flex flex-1 justify-start">
        <span className="w-11" aria-hidden />
      </div>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-col items-center gap-0.5 rounded px-2 py-0.5 text-gray-900 hover:bg-sky-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <FiX size={16} strokeWidth={2.2} aria-hidden />
          <span className="text-[11px] font-medium">Cancel</span>
        </button>
      </div>
      <div className="flex flex-1 justify-end">
        <span className="w-11" aria-hidden />
      </div>
    </div>
  );
}

function JerseyButton({
  jersey,
  accentColor,
  onClick,
}: {
  jersey: number;
  accentColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square w-9 shrink-0 cursor-pointer select-none items-center justify-center rounded-md border-none text-xs font-bold hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:w-10 sm:text-sm"
      style={jerseyAccentSurfaceStyle(accentColor)}
    >
      {jersey}
    </button>
  );
}

const grayPill =
  'w-full rounded-lg bg-gray-200 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-[12px]';

function SideColumn({
  side,
  teamName,
  accentColor,
  bench,
  onPick,
}: {
  side: TeamSide;
  teamName: string;
  accentColor: string;
  bench: number[];
  onPick: (pick: PanelFoulPick) => void;
}) {
  const benchSorted = useMemo(() => [...bench].sort((a, b) => a - b), [bench]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <span className="text-center text-[10px] font-semibold text-gray-600">{teamName}</span>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-1">
          <span className="text-center text-[8px] font-semibold uppercase tracking-wide text-gray-500">
            Bench
          </span>
          <div className="flex flex-col items-center gap-1">
            {benchSorted.map((n, idx) => (
              <JerseyButton
                key={`${side}-bench-${idx}-${n}`}
                jersey={n}
                accentColor={accentColor}
                onClick={() => onPick({ kind: 'bench_player', jersey: n })}
              />
            ))}
          </div>
          <button type="button" onClick={() => onPick({ kind: 'bench' })} className={`${grayPill} mt-0.5`}>
            Bench
          </button>
          <button type="button" onClick={() => onPick({ kind: 'coach' })} className={grayPill}>
            Coach
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * FOUL strip: bench jerseys, team bench, coach. On-court fouler: use side column jerseys while this modal is open.
 */
const FoulPanelPickerModal: React.FC<FoulPanelPickerModalProps> = ({
  homeName,
  awayName,
  homeColor,
  awayColor,
  homeBench,
  awayBench,
  onPick,
  onCancel,
}) => {
  const titleClass =
    'mb-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide sm:mb-3 sm:text-xs';
  const titleStyle = { color: STAT_DASH.accentBlue };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="foul-panel-picker-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-3 sm:px-3 sm:pt-4">
        <h2 id="foul-panel-picker-title" className={titleClass} style={titleStyle}>
          Select fouler: bench jersey, team bench, or coach
        </h2>
        <div className="flex min-h-0 flex-row justify-center gap-3 sm:gap-6">
          <SideColumn
            side="home"
            teamName={homeName}
            accentColor={homeColor}
            bench={homeBench}
            onPick={(pick) => onPick('home', pick)}
          />
          <SideColumn
            side="away"
            teamName={awayName}
            accentColor={awayColor}
            bench={awayBench}
            onPick={(pick) => onPick('away', pick)}
          />
        </div>
      </div>
      <PanelFooter onCancel={onCancel} />
    </div>
  );
};

export default FoulPanelPickerModal;
