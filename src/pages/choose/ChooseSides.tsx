import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiRepeat } from 'react-icons/fi';
import StatisticianLayout from '../../components/StatisticianLayout';
import { useStatisticianTeamColors } from '../../contexts/StatisticianTeamColorsContext';
import { writeGameSetupOrientation } from '../gameSetupOrientation';
import { readStoredSessionContext } from '../../features/statdash/sessionContextStorage';
import { GATEWAY_DISPLAY_FONT_STACK, GATEWAY_FONT_STACK } from '../../authGatewayTheme';

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
const ARROW_OPACITY = 0.6;

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
  const stroke = '#2A2440';
  const sw = 1.8;

  return (
    <g>
      <defs>
        <linearGradient id="courtWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FCF5E9" />
          <stop offset="100%" stopColor="#F2E1C4" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={CW} height={CH} fill="url(#courtWood)" stroke={stroke} strokeWidth={sw} />
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

function TeamTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

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
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F8FA]"
        style={{ fontFamily: GATEWAY_FONT_STACK }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/starters-bg.jpg')",
            opacity: 0.28,
            filter: 'blur(24px)',
            transform: 'scale(1.08)',
          }}
        />

        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/60 bg-white/70 px-6 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md sm:px-8">
          <button
            type="button"
            onClick={() => navigate('/starters')}
            className="flex items-center gap-1.5 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <FiArrowLeft size={15} />
            Back
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleContinue}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {isSaving ? 'Saving…' : 'Continue'}
            <FiArrowRight size={16} />
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 sm:px-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1
              className="text-[2.1rem] leading-none text-gray-900 sm:text-[2.4rem]"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK }}
            >
              Choose shooting sides
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Set which side each team starts on, and which basket they&rsquo;re attacking.
            </p>
          </div>

          <div className="flex w-full max-w-4xl flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.3)] sm:flex-row sm:items-center sm:gap-6 sm:p-8">
            <div className="flex shrink-0 gap-2 sm:flex-col">
              {([1, 2] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCourtType(t)}
                  className={`flex items-center gap-2 rounded-lg border-[1.5px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    courtType === t
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      courtType === t ? 'border-sky-500' : 'border-gray-300'
                    }`}
                  >
                    {courtType === t && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                  </span>
                  Type {t}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
              <div className="w-full max-w-2xl shadow-inner">
                <svg
                  viewBox={`0 0 ${CW} ${CH}`}
                  width="100%"
                  style={{ display: 'block' }}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <BasketballCourt />
                  <Arrow direction={leftDir} color={leftColor} />
                  <Arrow direction={rightDir} color={rightColor} />
                  <g
                    onClick={() => setSwapped((s) => !s)}
                    style={{ cursor: 'pointer' }}
                    aria-label="Swap sides"
                  >
                    <circle cx={CX} cy={CY} r={27} fill="#111827" />
                    <circle cx={CX} cy={CY} r={27} fill="none" stroke="#ffffff" strokeOpacity={0.15} strokeWidth={1.5} />
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

              <div className="flex w-full max-w-2xl justify-between gap-4 px-0">
                <TeamTag label={leftLabel} color={leftColor} />
                <TeamTag label={rightLabel} color={rightColor} />
              </div>

              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <FiRepeat size={12} />
                Tap the center of the court to swap sides
              </p>
            </div>
          </div>
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default ChooseSides;
