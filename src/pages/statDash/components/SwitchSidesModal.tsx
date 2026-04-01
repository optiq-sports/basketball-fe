import React, { useMemo, useState } from 'react';
import { writeGameSetupOrientation } from '../../gameSetupOrientation';

export interface SwitchSidesModalProps {
  open: boolean;
  homeColor: string;
  awayColor: string;
  initialHomeOnLeft: boolean;
  initialHomeAttacksLeft: boolean;
  onApply: (next: { homeOnLeft: boolean; homeAttacksLeft: boolean }) => void;
  onClose: () => void;
}

const SwitchSidesModal: React.FC<SwitchSidesModalProps> = ({
  open,
  homeColor,
  awayColor,
  initialHomeOnLeft,
  initialHomeAttacksLeft,
  onApply,
  onClose,
}) => {
  const CW = 620;
  const CH = 340;
  const CX = CW / 2;
  const CY = CH / 2;
  const KEY_W = 140;
  const KEY_H = 100;
  const KEY_Y1 = CY - KEY_H / 2;
  const KEY_Y2 = CY + KEY_H / 2;
  const BASKET_X_L = 44;
  const BASKET_X_R = CW - 44;
  const FT_R = 48;
  const THREE_R = 172;
  const THREE_X = 120;
  const BODY_HALF = 22;
  const HEAD_HALF = 68;
  const BODY_START = CX;
  const HEAD_BASE_L = KEY_W;
  const HEAD_BASE_R = CW - KEY_W;
  const ARROW_OPACITY = 0.55;

  const [homeOnLeft, setHomeOnLeft] = useState(initialHomeOnLeft);
  const [courtType, setCourtType] = useState<1 | 2>(initialHomeAttacksLeft ? 1 : 2);

  const leftLabel = homeOnLeft ? 'TEAM 1' : 'TEAM 2';
  const rightLabel = homeOnLeft ? 'TEAM 2' : 'TEAM 1';
  const leftColor = homeOnLeft ? homeColor : awayColor;
  const rightColor = homeOnLeft ? awayColor : homeColor;
  const leftDir: 'left' | 'right' = courtType === 1 ? 'left' : 'right';
  const rightDir: 'left' | 'right' = courtType === 1 ? 'right' : 'left';

  const homeAttacksLeft = useMemo(() => {
    return homeOnLeft ? courtType === 1 : courtType === 2;
  }, [homeOnLeft, courtType]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[210] flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-6xl rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Choose Shooting Sides</h2>
        <p className="mt-1 text-sm text-gray-600">Switch sides and apply immediately.</p>

        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center gap-8 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-4">
            {([1, 2] as const).map((t) => (
              <label
                key={t}
                className="flex cursor-pointer select-none items-center gap-3 text-sm text-black"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                  {courtType === t && <span className="block h-2.5 w-2.5 rounded-full bg-gray-800" />}
                </span>
                <span>Type {t}</span>
                <input
                  type="radio"
                  name="switch-side-court-type"
                  checked={courtType === t}
                  onChange={() => setCourtType(t)}
                  className="sr-only"
                />
              </label>
            ))}
          </div>

          <div className="flex min-w-0 max-w-4xl flex-1 flex-col items-center gap-3">
            <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <svg
                viewBox={`0 0 ${CW} ${CH}`}
                width="100%"
                style={{ display: 'block' }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x={0} y={0} width={CW} height={CH} fill="#ffffff" stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={CX} y1={0} x2={CX} y2={CH} stroke="#1a1a2e" strokeWidth={1.8} />
                <circle cx={CX} cy={CY} r={50} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <rect x={0} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={KEY_W} y1={KEY_Y1} x2={KEY_W} y2={KEY_Y2} stroke="#1a1a2e" strokeWidth={1.8} />
                <path d={`M ${KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 1 ${KEY_W} ${KEY_Y2}`} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={0} y1={22} x2={THREE_X} y2={22} stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={0} y1={CH - 22} x2={THREE_X} y2={CH - 22} stroke="#1a1a2e" strokeWidth={1.8} />
                <path d={`M ${THREE_X} 22 A ${THREE_R} ${THREE_R} 0 0 1 ${THREE_X} ${CH - 22}`} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <circle cx={BASKET_X_L} cy={CY} r={7} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <rect x={CW - KEY_W} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={CW - KEY_W} y1={KEY_Y1} x2={CW - KEY_W} y2={KEY_Y2} stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={CW} y1={22} x2={CW - THREE_X} y2={22} stroke="#1a1a2e" strokeWidth={1.8} />
                <line x1={CW} y1={CH - 22} x2={CW - THREE_X} y2={CH - 22} stroke="#1a1a2e" strokeWidth={1.8} />
                <path d={`M ${CW - THREE_X} 22 A ${THREE_R} ${THREE_R} 0 0 0 ${CW - THREE_X} ${CH - 22}`} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />
                <circle cx={BASKET_X_R} cy={CY} r={7} fill="none" stroke="#1a1a2e" strokeWidth={1.8} />

                {leftDir === 'left' ? (
                  <polygon points={[
                    `${BODY_START},${CY - BODY_HALF}`, `${BODY_START},${CY + BODY_HALF}`,
                    `${HEAD_BASE_L},${CY + BODY_HALF}`, `${HEAD_BASE_L},${CY + HEAD_HALF}`,
                    `${BASKET_X_L},${CY}`, `${HEAD_BASE_L},${CY - HEAD_HALF}`, `${HEAD_BASE_L},${CY - BODY_HALF}`,
                  ].join(' ')} fill={leftColor} opacity={ARROW_OPACITY} />
                ) : (
                  <polygon points={[
                    `${BODY_START},${CY - BODY_HALF}`, `${HEAD_BASE_R},${CY - BODY_HALF}`,
                    `${HEAD_BASE_R},${CY - HEAD_HALF}`, `${BASKET_X_R},${CY}`,
                    `${HEAD_BASE_R},${CY + HEAD_HALF}`, `${HEAD_BASE_R},${CY + BODY_HALF}`, `${BODY_START},${CY + BODY_HALF}`,
                  ].join(' ')} fill={leftColor} opacity={ARROW_OPACITY} />
                )}
                {rightDir === 'left' ? (
                  <polygon points={[
                    `${BODY_START},${CY - BODY_HALF}`, `${BODY_START},${CY + BODY_HALF}`,
                    `${HEAD_BASE_L},${CY + BODY_HALF}`, `${HEAD_BASE_L},${CY + HEAD_HALF}`,
                    `${BASKET_X_L},${CY}`, `${HEAD_BASE_L},${CY - HEAD_HALF}`, `${HEAD_BASE_L},${CY - BODY_HALF}`,
                  ].join(' ')} fill={rightColor} opacity={ARROW_OPACITY} />
                ) : (
                  <polygon points={[
                    `${BODY_START},${CY - BODY_HALF}`, `${HEAD_BASE_R},${CY - BODY_HALF}`,
                    `${HEAD_BASE_R},${CY - HEAD_HALF}`, `${BASKET_X_R},${CY}`,
                    `${HEAD_BASE_R},${CY + HEAD_HALF}`, `${HEAD_BASE_R},${CY + BODY_HALF}`, `${BODY_START},${CY + BODY_HALF}`,
                  ].join(' ')} fill={rightColor} opacity={ARROW_OPACITY} />
                )}

                <g onClick={() => setHomeOnLeft((v) => !v)} style={{ cursor: 'pointer' }}>
                  <circle cx={CX} cy={CY} r={26} fill="#000" />
                  <g transform={`translate(${CX}, ${CY})`}>
                    <path d="M -6 -4 L -10 0 L -6 4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 6 -4 L 10 0 L 6 4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              </svg>
            </div>

            <div className="flex w-full justify-between gap-4 px-0">
              <span className="shrink-0 rounded-lg px-5 py-2 text-sm font-bold text-white" style={{ backgroundColor: leftColor }}>
                {leftLabel}
              </span>
              <span className="shrink-0 rounded-lg px-5 py-2 text-sm font-bold text-white" style={{ backgroundColor: rightColor }}>
                {rightLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { homeOnLeft, homeAttacksLeft };
              writeGameSetupOrientation(next);
              onApply(next);
            }}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwitchSidesModal;
