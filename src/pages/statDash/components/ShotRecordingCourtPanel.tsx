import React from 'react';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import type { ActiveShotFlow, ShotTypeId } from '../shotRecordingUtils';
import { SHOT_TYPE_OPTIONS } from '../shotRecordingUtils';
import { STAT_DASH } from '../statDashTheme';

export interface ShotRecordingCourtPanelProps {
  flow: ActiveShotFlow;
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
  onPickShooter: (side: TeamSide, jersey: number) => void;
  onSelectShotType: (type: ShotTypeId) => void;
  onSetFastBreak: (value: boolean) => void;
  onSelectAssist: (assist: number | 'none') => void;
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

/**
 * In-place shot recording UI (replaces the court). No full-screen overlay.
 */
const ShotRecordingCourtPanel: React.FC<ShotRecordingCourtPanelProps> = ({
  flow,
  homeName,
  awayName,
  homePlayers,
  awayPlayers,
  homeColor,
  awayColor,
  onBack,
  onCancel,
  onPickShooter,
  onSelectShotType,
  onSetFastBreak,
  onSelectAssist,
}) => {
  const { entry, step, draft } = flow;

  const showBack =
    step === 'assist' || (step === 'shotType' && (entry === 'court' || entry === 'player'));

  const titleClass =
    'mb-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide sm:mb-3 sm:text-xs';
  const titleStyle = { color: STAT_DASH.accentBlue };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shot-flow-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-3 sm:px-3 sm:pt-4">
        {step === 'pickShooter' && (
          <>
            <h2 id="shot-flow-title" className={titleClass} style={titleStyle}>
              {draft.result === 'made' ? 'Select player for made shot' : 'Select player for missed shot'}
            </h2>
            <div className="mx-auto max-w-[360px] rounded-lg bg-gray-100 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-gray-700">Select shooter from side jersey lists</p>
              <p className="mt-1 text-xs text-gray-500">{homeName} and {awayName} players are selectable by the court sides.</p>
            </div>
          </>
        )}

        {step === 'shotType' && (
          <>
            <h2 id="shot-flow-title" className={titleClass} style={titleStyle}>
              Shot type
            </h2>
            <div className="mx-auto grid max-w-[320px] grid-cols-2 gap-2.5 sm:gap-3">
              {SHOT_TYPE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectShotType(id)}
                  className="rounded-lg bg-gray-200 px-3 py-3 text-center text-[12px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:py-3 sm:text-[13px]"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mx-auto mt-4 flex max-w-[320px] items-center justify-between gap-3 rounded-lg bg-gray-200 px-4 py-3 sm:mt-5">
              <span className="text-[12px] font-medium text-black sm:text-[13px]">Fast break</span>
              {draft.fastBreak ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked="true"
                  aria-label="Fast break"
                  onClick={() => onSetFastBreak(false)}
                  className="relative h-6 w-11 shrink-0 rounded-full bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                >
                  <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                </button>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked="false"
                  aria-label="Fast break"
                  onClick={() => onSetFastBreak(true)}
                  className="relative h-6 w-11 shrink-0 rounded-full bg-gray-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                >
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
                </button>
              )}
            </div>
          </>
        )}

        {step === 'assist' && draft.side !== null && draft.shooterJersey !== null && (
          <>
            <h2 id="shot-flow-title" className={titleClass} style={titleStyle}>
              Select player for assist
            </h2>
            <div className="mx-auto flex max-w-[240px] flex-col items-stretch gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onSelectAssist('none')}
                className="rounded-lg bg-slate-200 px-3 py-2 text-center text-[11px] font-medium text-black hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-xs"
              >
                No Assist
              </button>
              <div className="flex flex-wrap justify-center gap-1.5">
                {(draft.side === 'home' ? homePlayers : awayPlayers)
                  .filter((n) => n !== draft.shooterJersey)
                  .map((n) => (
                    <JerseyButton
                      key={n}
                      jersey={n}
                      accentColor={draft.side === 'home' ? homeColor : awayColor}
                      onClick={() => onSelectAssist(n)}
                    />
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      <PanelFooter showBack={showBack} onBack={onBack} onCancel={onCancel} />
    </div>
  );
};

export default ShotRecordingCourtPanel;
