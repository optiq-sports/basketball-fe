import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import StatisticianLayout from '../../components/StatisticianLayout';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { writeGameSetupOrientation } from '../gameSetupOrientation';
import { readStoredSessionContext } from '../../features/statdash/sessionContextStorage';

const FOOTER_BG = '#F3F4F6';

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

interface ArrowProps {
  direction: 'left' | 'right';
  color: string;
}

const Arrow: React.FC<ArrowProps> = ({ direction, color }) => {
  if (direction === 'left') {
    const pts = [
      `${BODY_START},${CY - BODY_HALF}`,
      `${BODY_START},${CY + BODY_HALF}`,
      `${HEAD_BASE_L},${CY + BODY_HALF}`,
      `${HEAD_BASE_L},${CY + HEAD_HALF}`,
      `${BASKET_X_L},${CY}`,
      `${HEAD_BASE_L},${CY - HEAD_HALF}`,
      `${HEAD_BASE_L},${CY - BODY_HALF}`,
    ].join(' ');
    return <polygon points={pts} fill={color} opacity={ARROW_OPACITY} />;
  }
  const pts = [
    `${BODY_START},${CY - BODY_HALF}`,
    `${HEAD_BASE_R},${CY - BODY_HALF}`,
    `${HEAD_BASE_R},${CY - HEAD_HALF}`,
    `${BASKET_X_R},${CY}`,
    `${HEAD_BASE_R},${CY + HEAD_HALF}`,
    `${HEAD_BASE_R},${CY + BODY_HALF}`,
    `${BODY_START},${CY + BODY_HALF}`,
  ].join(' ');
  return <polygon points={pts} fill={color} opacity={ARROW_OPACITY} />;
};

const BasketballCourt: React.FC = () => {
  const stroke = '#1a1a2e';
  const sw = 1.8;
  const fill = '#ffffff';

  return (
    <g>
      <rect x={0} y={0} width={CW} height={CH} fill={fill} stroke={stroke} strokeWidth={sw} />
      <line x1={CX} y1={0} x2={CX} y2={CH} stroke={stroke} strokeWidth={sw} />
      <circle cx={CX} cy={CY} r={50} fill="none" stroke={stroke} strokeWidth={sw} />

      <rect x={0} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={KEY_W} y1={KEY_Y1} x2={KEY_W} y2={KEY_Y2} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 1 ${KEY_W} ${KEY_Y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
      />
      <path
        d={`M ${KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 0 ${KEY_W} ${KEY_Y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray="5 4"
      />
      <line x1={0} y1={22} x2={THREE_X} y2={22} stroke={stroke} strokeWidth={sw} />
      <line x1={0} y1={CH - 22} x2={THREE_X} y2={CH - 22} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${THREE_X} 22 A ${THREE_R} ${THREE_R} 0 0 1 ${THREE_X} ${CH - 22}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
      />
      <circle cx={BASKET_X_L} cy={CY} r={7} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={8} y1={CY - 20} x2={8} y2={CY + 20} stroke={stroke} strokeWidth={3} />
      {[0.25, 0.45, 0.65, 0.85].map((f) => (
        <React.Fragment key={f}>
          <line x1={KEY_W * f} y1={KEY_Y1} x2={KEY_W * f} y2={KEY_Y1 - 6} stroke={stroke} strokeWidth={sw} />
          <line x1={KEY_W * f} y1={KEY_Y2} x2={KEY_W * f} y2={KEY_Y2 + 6} stroke={stroke} strokeWidth={sw} />
        </React.Fragment>
      ))}

      <rect x={CW - KEY_W} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={CW - KEY_W} y1={KEY_Y1} x2={CW - KEY_W} y2={KEY_Y2} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${CW - KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 0 ${CW - KEY_W} ${KEY_Y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
      />
      <path
        d={`M ${CW - KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 1 ${CW - KEY_W} ${KEY_Y2}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray="5 4"
      />
      <line x1={CW} y1={22} x2={CW - THREE_X} y2={22} stroke={stroke} strokeWidth={sw} />
      <line x1={CW} y1={CH - 22} x2={CW - THREE_X} y2={CH - 22} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${CW - THREE_X} 22 A ${THREE_R} ${THREE_R} 0 0 0 ${CW - THREE_X} ${CH - 22}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
      />
      <circle cx={BASKET_X_R} cy={CY} r={7} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={CW - 8} y1={CY - 20} x2={CW - 8} y2={CY + 20} stroke={stroke} strokeWidth={3} />
      {[0.25, 0.45, 0.65, 0.85].map((f) => (
        <React.Fragment key={f}>
          <line x1={CW - KEY_W * f} y1={KEY_Y1} x2={CW - KEY_W * f} y2={KEY_Y1 - 6} stroke={stroke} strokeWidth={sw} />
          <line x1={CW - KEY_W * f} y1={KEY_Y2} x2={CW - KEY_W * f} y2={KEY_Y2 + 6} stroke={stroke} strokeWidth={sw} />
        </React.Fragment>
      ))}
    </g>
  );
};

const ChooseSides: React.FC = () => {
  const navigate = useNavigate();
  const { homeTeamColor, awayTeamColor } = useStatisticianTeamColors();
  const [swapped, setSwapped] = useState(false);
  const [courtType, setCourtType] = useState<1 | 2>(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!readStoredSessionContext()) {
      navigate('/match-key', { replace: true });
    }
  }, [navigate]);

  const team1Color = homeTeamColor;
  const team2Color = awayTeamColor;

  const leftColor = swapped ? team2Color : team1Color;
  const rightColor = swapped ? team1Color : team2Color;
  const leftLabel = swapped ? 'TEAM 2' : 'TEAM 1';
  const rightLabel = swapped ? 'TEAM 1' : 'TEAM 2';

  const leftDir: 'left' | 'right' = courtType === 1 ? 'left' : 'right';
  const rightDir: 'left' | 'right' = courtType === 1 ? 'right' : 'left';
  const homeOnLeft = !swapped;
  const homeAttacksLeft = homeOnLeft ? leftDir === 'left' : rightDir === 'left';

  const handleContinue = async () => {
    const orientation = { homeOnLeft, homeAttacksLeft };
    writeGameSetupOrientation(orientation);
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsSaving(true);
    navigate('/jump-ball');
    setIsSaving(false);
  };

  return (
    <StatisticianLayout>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white font-sans">
        <div className="flex shrink-0 items-center justify-between px-6 py-3">
          <button
            type="button"
            onClick={() => navigate('/starters')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
          >
            <FiArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleContinue}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
          >
            <span>{isSaving ? 'Saving…' : 'Continue'}</span>
            <FiArrowRight size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <h1 className="shrink-0 pb-4 pt-6 text-center text-xl font-bold text-gray-900">
            Choose Shooting Sides
          </h1>

          <div className="flex min-h-0 flex-1 items-center justify-center gap-8 overflow-hidden px-6">
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
                    name="courtType"
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
                  <BasketballCourt />
                  <Arrow direction={leftDir} color={leftColor} />
                  <Arrow direction={rightDir} color={rightColor} />
                  <g onClick={() => setSwapped((s) => !s)} style={{ cursor: 'pointer' }}>
                    <circle cx={CX} cy={CY} r={26} fill="#000" />
                    <g transform={`translate(${CX}, ${CY})`}>
                      <path
                        d="M -6 -4 L -10 0 L -6 4"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 6 -4 L 10 0 L 6 4"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  </g>
                </svg>
              </div>

              <div className="flex w-full justify-between gap-4 px-0">
                <span
                  className="shrink-0 rounded-lg px-5 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: leftColor }}
                >
                  {leftLabel}
                </span>
                <span
                  className="shrink-0 rounded-lg px-5 py-2 text-sm font-bold text-white"
                  style={{ backgroundColor: rightColor }}
                >
                  {rightLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between px-6 py-4" style={{ backgroundColor: FOOTER_BG }}>
          <div />
          <div />
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default ChooseSides;
