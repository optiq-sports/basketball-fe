import React, { useMemo } from 'react';
import { FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import { getContrastTextColor, normalizeHex } from '../../../contexts/StatisticianTeamColorsContext';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';
import type { PanelFoulPick } from '../foulRecordingUtils';

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
    <div className="flex h-14 shrink-0 items-center justify-center border-t border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <FiX size={16} strokeWidth={2.2} aria-hidden />
        Cancel
      </button>
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
  const normalized = normalizeHex(accentColor) ?? accentColor;
  const text = getContrastTextColor(normalized);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square w-10 shrink-0 cursor-pointer select-none items-center justify-center border-none font-bold leading-none shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:w-11"
      style={{ background: normalized, color: text, fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 16 }}
    >
      {jersey}
    </button>
  );
}

const neutralPill =
  'w-full border border-gray-300 bg-white px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-xs';

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
      <span className="text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">{teamName}</span>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-2">
          <span className="text-center text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Bench
          </span>
          <div className="flex flex-col items-center gap-1.5">
            {benchSorted.map((n, idx) => (
              <JerseyButton
                key={`${side}-bench-${idx}-${n}`}
                jersey={n}
                accentColor={accentColor}
                onClick={() => onPick({ kind: 'bench_player', jersey: n })}
              />
            ))}
          </div>
          <button type="button" onClick={() => onPick({ kind: 'bench' })} className={`${neutralPill} mt-1`}>
            Bench
          </button>
          <button type="button" onClick={() => onPick({ kind: 'coach' })} className={neutralPill}>
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
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="foul-panel-picker-title"
    >
      <div className="shrink-0 border-b border-gray-200 bg-gray-900 px-4 py-3 sm:px-6">
        <h2
          id="foul-panel-picker-title"
          className="text-white"
          style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 18, letterSpacing: 0.5 }}
        >
          Select fouler
        </h2>
        <p className="mt-0.5 text-[11px] font-medium text-gray-400">Bench jersey, team bench, or coach</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-h-0 flex-row justify-center gap-4 sm:gap-8">
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
