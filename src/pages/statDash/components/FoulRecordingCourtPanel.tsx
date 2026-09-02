import React from "react";
import { FiArrowLeft, FiX } from "react-icons/fi";
import type { TeamSide } from "../types";
import { getContrastTextColor, normalizeHex } from "../../../contexts/StatisticianTeamColorsContext";
import { GATEWAY_DISPLAY_FONT_STACK } from "../../../authGatewayTheme";
import type { ActiveFoulFlow, FoulTypeId } from "../foulRecordingUtils";
import { FOUL_TYPE_OPTIONS, opponentOf } from "../foulRecordingUtils";

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
  onFtAssistSelect: (assist: number | "none") => void;
  onFtResult: (result: "made" | "miss") => void;
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
  "mb-2 border-b border-gray-200 pb-2 text-center text-xs font-bold uppercase leading-tight tracking-wide text-gray-900 sm:mb-3 sm:pb-3 sm:text-sm";

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
      className="flex aspect-square w-9 shrink-0 cursor-pointer select-none items-center justify-center border-none font-bold leading-none shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:w-10"
      style={{ background: normalized, color: text, fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 15 }}
    >
      {jersey}
    </button>
  );
}

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
  onSelectFoulType,
  onSelectFtCount,
  onFtAssistSelect,
  onFtResult,
}) => {
  const { entry, step, draft } = flow;

  const showFooterBack = !(step === "pickFouler" && entry === "court");

  const fouledSide =
    draft.foulerSide !== null ? opponentOf(draft.foulerSide) : null;
  const nextFtIndex = draft.ftResults.length;
  const ftCount = draft.ftCount ?? 0;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="foul-flow-title"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        {step === "pickFouler" && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              Select player who fouled
            </h2>
            <div className="mx-auto max-w-[360px] border border-gray-300 bg-gray-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-gray-700">
                Tap an on-court jersey on the side columns, or press{" "}
                <span className="font-bold">FOUL</span> on a panel to choose a
                bench jersey, team bench, or coach.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {homeName} and {awayName}
              </p>
            </div>
          </>
        )}

        {step === "foulType" && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              Select foul type
            </h2>
            <div className="mx-auto grid max-w-[320px] grid-cols-2 gap-2 sm:gap-2.5">
              {FOUL_TYPE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectFoulType(id)}
                  className="border border-gray-300 bg-gray-50 px-3 py-3 text-center text-[11px] font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-[12px]"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "pickFouled" && fouledSide !== null && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              {draft.foulType === "technical"
                ? "Select the free throw shooter"
                : draft.foulType === "double_foul"
                  ? "Select second fouler"
                  : "Select player who was fouled"}
            </h2>
            <div className="mx-auto max-w-[360px] border border-gray-300 bg-gray-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-gray-700">
                {draft.foulType === "technical"
                  ? "Technical foul recorded. Tap the jersey of the opposing player who will shoot the free throws."
                  : draft.foulType === "double_foul"
                    ? "Double foul — select the second player who was also fouling."
                    : "Select fouled player from side jersey lists"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {fouledSide === "home" ? homeName : awayName} side players are
                currently selectable.
              </p>
            </div>
          </>
        )}

        {step === "ftCount" && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              Select number of free throws awarded
            </h2>
            <div className="mx-auto flex max-w-[300px] flex-col gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSelectFtCount(n)}
                  className="border border-gray-300 bg-gray-50 px-4 py-3 text-center text-[12px] font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
                >
                  {n} Free Throw{n > 1 ? "s" : ""}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onSelectFtCount(0)}
                className="border border-gray-300 bg-gray-50 px-4 py-3 text-center text-[12px] font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                No free throws
              </button>
            </div>
          </>
        )}

        {step === "ftAssist" &&
          fouledSide !== null &&
          draft.fouledJersey !== null && (
            <>
              <h2
                id="foul-flow-title"
                className={titleClass}
               
              >
                Select player for assist (FT shooter: #{draft.fouledJersey})
              </h2>
              <div className="mx-auto flex max-w-[240px] flex-col items-stretch gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onFtAssistSelect("none")}
                  className="border border-gray-300 bg-gray-50 px-3 py-2 text-center text-[11px] font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 sm:text-xs"
                >
                  No assist
                </button>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(fouledSide === "home" ? homePlayers : awayPlayers)
                    .filter((n) => n !== draft.fouledJersey)
                    .map((n) => (
                      <JerseyButton
                        key={n}
                        jersey={n}
                        accentColor={
                          fouledSide === "home" ? homeColor : awayColor
                        }
                        onClick={() => onFtAssistSelect(n)}
                      />
                    ))}
                </div>
              </div>
            </>
          )}

        {step === "ftResults" && ftCount > 0 && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              Record free throw results
            </h2>
            <div className="mx-auto flex max-w-[260px] flex-col gap-2">
              {Array.from({ length: ftCount }, (_, i) => {
                const done = draft.ftResults[i];
                const active = i === nextFtIndex;
                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 border border-gray-200 p-2 ${
                      active ? "bg-white" : "bg-gray-50 opacity-80"
                    }`}
                  >
                    <span className="text-center text-[10px] font-semibold text-gray-700">
                      Shot {i + 1}
                      {done ? ` — ${done.toUpperCase()}` : ""}
                    </span>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() => onFtResult("made")}
                        className="bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        MADE
                      </button>
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() => onFtResult("miss")}
                        className="bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
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

        {step === "rebounder" && (
          <>
            <h2 id="foul-flow-title" className={titleClass}>
              Select player who rebounded the ball
            </h2>
            <div className="mx-auto max-w-[360px] border border-gray-300 bg-gray-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-gray-700">
                Select rebounder from side jersey lists
              </p>
            </div>
          </>
        )}
      </div>

      <PanelFooter
        showBack={showFooterBack}
        onBack={onBack}
        onCancel={onCancel}
      />
    </div>
  );
};

export default FoulRecordingCourtPanel;
