import React from 'react';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import type { ActiveTurnoverFlow, TurnoverTypeId } from '../turnoverRecordingUtils';
import { TURNOVER_TYPE_OPTIONS } from '../turnoverRecordingUtils';
import { opponentOf } from '../foulRecordingUtils';

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
    <div className="flex h-14 shrink-0 items-center justify-between border-t border-gray-200 bg-gray-50 px-4 sm:px-6">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <FiArrowLeft size={16} strokeWidth={2.2} aria-hidden />
          Back
        </button>
      ) : (
        <span aria-hidden />
      )}
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

const titleClass =
  'mb-2 border-b border-gray-200 pb-2 text-center text-xs font-bold uppercase leading-tight tracking-wide text-gray-900 sm:mb-3 sm:pb-3 sm:text-sm';

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

  const stealSide = opponentOf(committingSide);
  const stealName = stealSide === 'home' ? homeName : awayName;
  const showFooterBack = step !== 'pickPlayer';

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnover-flow-title"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        {step === 'pickPlayer' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass}>
              Select player for turnover
            </h2>
            <div className="mx-auto max-w-[360px] border border-gray-300 bg-gray-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-gray-700">Select player from side jersey lists</p>
              <p className="mt-1 text-xs text-gray-500">{committingName} players are selectable by the court sides.</p>
            </div>
          </>
        )}

        {step === 'turnoverType' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass}>
              Select turnover type
            </h2>
            <div className="mx-auto grid max-w-[340px] grid-cols-3 gap-2 sm:gap-2.5">
              {TURNOVER_TYPE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTurnoverType(id)}
                  className="border border-gray-300 bg-gray-50 px-2 py-2.5 text-center text-[10px] font-medium leading-tight text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:px-2.5 sm:text-[11px]"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'steal' && (
          <>
            <h2 id="turnover-flow-title" className={titleClass}>
              Select player for steal
            </h2>
            <div className="mx-auto flex max-w-[240px] flex-col items-center gap-3">
              <button
                type="button"
                onClick={onSelectNoSteal}
                className="w-full border border-gray-300 bg-gray-50 px-3 py-2.5 text-center text-[11px] font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                No Steal
              </button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{stealName}</span>
                <p className="text-center text-xs text-gray-500">Select stealer from side jersey lists.</p>
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
