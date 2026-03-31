import React from 'react';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import type { ActiveTurnoverFlow, TurnoverTypeId } from '../turnoverRecordingUtils';
import { TURNOVER_TYPE_OPTIONS } from '../turnoverRecordingUtils';
import { opponentOf } from '../foulRecordingUtils';
import { STAT_DASH } from '../statDashTheme';

export interface TurnoverRecordingCourtPanelProps {
  flow: ActiveTurnoverFlow;
  homeName: string;
  awayName: string;
  /** On-court jersey numbers only */
  homePlayers: number[];
  /** On-court jersey numbers only */
  awayPlayers: number[];
  homeColor: string;
  awayColor: string;
  onBack: () => void;
  onCancel: () => void;
  onPickCommittingPlayer: (jersey: number) => void;
  onSelectTurnoverType: (type: TurnoverTypeId) => void;
  onSelectNoSteal: () => void;
  onPickStealer: (side: TeamSide, jersey: number) => void;
}

function PanelFooter({
  showBack,
  onBack,
  onCancel,
}: {
  showBack: boolean;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex shrink-0 items-stretch border-t border-gray-200 bg-sky-100/80 px-2 py-2.5 sm:px-3">
      <div className="flex flex-1 justify-start">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex flex-col items-center gap-0.5 rounded px-2 py-0.5 text-gray-900 hover:bg-sky-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <FiArrowLeft size={16} strokeWidth={2.2} aria-hidden />
            <span className="text-[11px] font-medium">Back</span>
          </button>
        ) : (
          <span className="w-11" aria-hidden />
        )}
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
      className="flex aspect-square w-9 shrink-0 cursor-pointer select-none items-center justify-center rounded-md border-none text-xs font-bold text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:w-10 sm:text-sm"
      style={{ background: accentColor }}
    >
      {jersey}
    </button>
  );
}

const titleClass =
  'mb-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:mb-3 sm:text-[11px]';
const titleStyle = { color: STAT_DASH.accentBlue };

const TurnoverRecordingCourtPanel: React.FC<TurnoverRecordingCourtPanelProps> = ({
  flow,
  homeName,
  awayName,
  homePlayers,
  awayPlayers,
  homeColor,
  awayColor,
  onBack,
  onCancel,
  onPickCommittingPlayer,
  onSelectTurnoverType,
  onSelectNoSteal,
  onPickStealer,
}) => {
  const { step, draft } = flow;
  const { committingSide } = draft;
  const committingName = committingSide === 'home' ? homeName : awayName;
  const committingPlayers = committingSide === 'home' ? homePlayers : awayPlayers;
  const committingColor = committingSide === 'home' ? homeColor : awayColor;

  const stealSide = opponentOf(committingSide);
  const stealName = stealSide === 'home' ? homeName : awayName;
  const stealPlayers = stealSide === 'home' ? homePlayers : awayPlayers;
  const stealColor = stealSide === 'home' ? homeColor : awayColor;

  const showFooterBack = step !== 'pickPlayer';

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnover-flow-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        {step === 'pickPlayer' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass} style={titleStyle}>
              Select player for turnover
            </h2>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-600">{committingName}</span>
              <div className="flex flex-col gap-1">
                {committingPlayers.map((n) => (
                  <JerseyButton
                    key={n}
                    jersey={n}
                    accentColor={committingColor}
                    onClick={() => onPickCommittingPlayer(n)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'turnoverType' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass} style={titleStyle}>
              Select turnover type
            </h2>
            <div className="mx-auto grid max-w-[340px] grid-cols-3 gap-2 sm:gap-2.5">
              {TURNOVER_TYPE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTurnoverType(id)}
                  className="rounded-lg bg-gray-200 px-2 py-2.5 text-center text-[10px] font-medium leading-tight text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:px-2.5 sm:text-[11px]"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'steal' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass} style={titleStyle}>
              Select player for steal
            </h2>
            <div className="mx-auto flex max-w-[240px] flex-col items-center gap-3">
              <button
                type="button"
                onClick={onSelectNoSteal}
                className="w-full rounded-lg bg-gray-200 px-3 py-2.5 text-center text-[11px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                No Steal
              </button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{stealName}</span>
                <div className="flex flex-col gap-1">
                  {stealPlayers.map((n) => (
                    <JerseyButton
                      key={n}
                      jersey={n}
                      accentColor={stealColor}
                      onClick={() => onPickStealer(stealSide, n)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <PanelFooter showBack={showFooterBack} onBack={onBack} onCancel={onCancel} />
    </div>
  );
};

export default TurnoverRecordingCourtPanel;
