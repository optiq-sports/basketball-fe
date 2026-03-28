import React from 'react';
import { FiArrowLeft, FiX } from 'react-icons/fi';
import type { TeamSide } from '../types';
import type { ActiveFoulFlow, FoulTypeId } from '../foulRecordingUtils';
import { FOUL_TYPE_OPTIONS, opponentOf } from '../foulRecordingUtils';
import { STAT_DASH } from '../statDashTheme';

export interface FoulRecordingCourtPanelProps {
  flow: ActiveFoulFlow;
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
  onPickFouler: (side: TeamSide, jersey: number) => void;
  onSelectFoulType: (type: FoulTypeId) => void;
  onPickFouled: (jersey: number) => void;
  onSelectFtCount: (count: 0 | 1 | 2 | 3) => void;
  onFtShooterSamePlayer: () => void;
  onFtResult: (result: 'made' | 'miss') => void;
  onPickRebounder: (side: TeamSide, jersey: number) => void;
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
  'mb-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wide sm:mb-2 sm:text-[11px]';
const titleStyle = { color: STAT_DASH.accentBlue };

const FoulRecordingCourtPanel: React.FC<FoulRecordingCourtPanelProps> = ({
  flow,
  homeName,
  awayName,
  homePlayers,
  awayPlayers,
  homeColor,
  awayColor,
  onBack,
  onCancel,
  onPickFouler,
  onSelectFoulType,
  onPickFouled,
  onSelectFtCount,
  onFtShooterSamePlayer,
  onFtResult,
  onPickRebounder,
}) => {
  const { entry, step, draft } = flow;

  const showFooterBack = !(step === 'pickFouler' && entry === 'court');

  const fouledSide =
    draft.foulerSide !== null ? opponentOf(draft.foulerSide) : null;
  const fouledPlayers = fouledSide === 'home' ? homePlayers : fouledSide === 'away' ? awayPlayers : [];
  const fouledColor = fouledSide === 'home' ? homeColor : fouledSide === 'away' ? awayColor : '#64748b';

  const nextFtIndex = draft.ftResults.length;
  const ftCount = draft.ftCount ?? 0;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="foul-flow-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        {step === 'pickFouler' && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select player who fouled
            </h2>
            <div className="flex justify-center gap-4 sm:gap-8">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{homeName}</span>
                <div className="flex flex-col gap-1">
                  {homePlayers.map((n) => (
                    <JerseyButton
                      key={`hf-${n}`}
                      jersey={n}
                      accentColor={homeColor}
                      onClick={() => onPickFouler('home', n)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{awayName}</span>
                <div className="flex flex-col gap-1">
                  {awayPlayers.map((n) => (
                    <JerseyButton
                      key={`af-${n}`}
                      jersey={n}
                      accentColor={awayColor}
                      onClick={() => onPickFouler('away', n)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'foulType' && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select foul type
            </h2>
            <div className="mx-auto grid max-w-[280px] grid-cols-2 gap-1.5 sm:gap-2">
              {FOUL_TYPE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectFoulType(id)}
                  className="rounded-lg bg-gray-200 px-2 py-2 text-center text-[10px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-[11px]"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'pickFouled' && fouledSide !== null && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select player who was fouled
            </h2>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-600">
                {fouledSide === 'home' ? homeName : awayName}
              </span>
              <div className="flex flex-col gap-1">
                {fouledPlayers.map((n) => (
                  <JerseyButton
                    key={n}
                    jersey={n}
                    accentColor={fouledColor}
                    onClick={() => onPickFouled(n)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'ftCount' && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select number of free throws awarded
            </h2>
            <div className="mx-auto flex max-w-[260px] flex-col gap-1.5">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSelectFtCount(n)}
                  className="rounded-lg bg-gray-200 px-3 py-2 text-center text-[11px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                >
                  {n} Free Throw{n > 1 ? 's' : ''}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onSelectFtCount(0)}
                className="rounded-lg bg-gray-200 px-3 py-2 text-center text-[11px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                No free throws
              </button>
            </div>
          </>
        )}

        {step === 'ftShooter' && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select player shooting
            </h2>
            <div className="mx-auto max-w-[240px]">
              <button
                type="button"
                onClick={onFtShooterSamePlayer}
                className="w-full rounded-lg bg-gray-200 px-3 py-3 text-center text-[11px] font-medium text-black hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Same player
              </button>
            </div>
          </>
        )}

        {step === 'ftResults' && ftCount > 0 && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Record free throw results
            </h2>
            <div className="mx-auto flex max-w-[260px] flex-col gap-2">
              {Array.from({ length: ftCount }, (_, i) => {
                const done = draft.ftResults[i];
                const active = i === nextFtIndex;
                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 rounded-lg border border-gray-200 p-2 ${
                      active ? 'bg-white' : 'bg-gray-50 opacity-80'
                    }`}
                  >
                    <span className="text-center text-[10px] font-semibold text-gray-700">
                      Shot {i + 1}
                      {done ? ` — ${done.toUpperCase()}` : ''}
                    </span>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() => onFtResult('made')}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        MADE
                      </button>
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() => onFtResult('miss')}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        MISS
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 'rebounder' && (
          <>
            <h2 id="foul-flow-title" className={titleClass} style={titleStyle}>
              Select player who rebounded the ball
            </h2>
            <div className="flex justify-center gap-4 sm:gap-8">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{homeName}</span>
                <div className="flex flex-col gap-1">
                  {homePlayers.map((n) => (
                    <JerseyButton
                      key={`hr-${n}`}
                      jersey={n}
                      accentColor={homeColor}
                      onClick={() => onPickRebounder('home', n)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-gray-600">{awayName}</span>
                <div className="flex flex-col gap-1">
                  {awayPlayers.map((n) => (
                    <JerseyButton
                      key={`ar-${n}`}
                      jersey={n}
                      accentColor={awayColor}
                      onClick={() => onPickRebounder('away', n)}
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

export default FoulRecordingCourtPanel;
