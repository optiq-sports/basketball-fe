import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';

const TEAM_1_COLOR = '#E63946';
const TEAM_2_COLOR = '#D4A017';

// Court dimensions (SVG viewBox 620 × 340)
const CW = 620;
const CH = 340;
const CX = CW / 2; // 310
const CY = CH / 2; // 170

// Key / paint area
const KEY_W = 140;
const KEY_H = 100;
const KEY_Y1 = CY - KEY_H / 2; // 120
const KEY_Y2 = CY + KEY_H / 2; // 220

// Basket positions
const BASKET_X_L = 44;
const BASKET_X_R = CW - 44;

// Free-throw circle radius
const FT_R = 48;

// 3-point arc radius (from basket)
const THREE_R = 162;

// Arrow geometry
const BODY_HALF = 22;   // body height ±
const HEAD_HALF = 68;   // arrowhead height ±
const BODY_START = CX;  // arrow body starts at centre
const HEAD_BASE_L = KEY_W; // arrowhead base x (left side)  = 140
const HEAD_BASE_R = CW - KEY_W; // = 480
const ARROW_OPACITY = 0.55;

interface ArrowProps {
  direction: 'left' | 'right';
  color: string;
}

const Arrow: React.FC<ArrowProps> = ({ direction, color }) => {
  if (direction === 'left') {
    // Points toward LEFT basket — body from centre, head at left key
    const pts = [
      `${BODY_START},${CY - BODY_HALF}`,
      `${BODY_START},${CY + BODY_HALF}`,
      `${HEAD_BASE_L},${CY + BODY_HALF}`,
      `${HEAD_BASE_L},${CY + HEAD_HALF}`,
      `${BASKET_X_L},${CY}`,
      `${HEAD_BASE_L},${CY - HEAD_HALF}`,
      `${HEAD_BASE_L},${CY - BODY_HALF}`,
    ].join(' ');
    return (
      <polygon
        points={pts}
        fill={color}
        opacity={ARROW_OPACITY}
      />
    );
  }
  // Points toward RIGHT basket
  const pts = [
    `${BODY_START},${CY - BODY_HALF}`,
    `${HEAD_BASE_R},${CY - BODY_HALF}`,
    `${HEAD_BASE_R},${CY - HEAD_HALF}`,
    `${BASKET_X_R},${CY}`,
    `${HEAD_BASE_R},${CY + HEAD_HALF}`,
    `${HEAD_BASE_R},${CY + BODY_HALF}`,
    `${BODY_START},${CY + BODY_HALF}`,
  ].join(' ');
  return (
    <polygon
      points={pts}
      fill={color}
      opacity={ARROW_OPACITY}
    />
  );
};

const BasketballCourt: React.FC = () => {
  const stroke = '#1a1a2e';
  const sw = 1.8;
  const fill = '#ffffff';

  return (
    <g>
      {/* Court outline */}
      <rect x={0} y={0} width={CW} height={CH} fill={fill} stroke={stroke} strokeWidth={sw} />

      {/* Centre line */}
      <line x1={CX} y1={0} x2={CX} y2={CH} stroke={stroke} strokeWidth={sw} />

      {/* Centre circle */}
      <circle cx={CX} cy={CY} r={50} fill="none" stroke={stroke} strokeWidth={sw} />

      {/* === LEFT SIDE === */}
      {/* Left paint / key rectangle */}
      <rect x={0} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke={stroke} strokeWidth={sw} />
      {/* Left free-throw line */}
      <line x1={KEY_W} y1={KEY_Y1} x2={KEY_W} y2={KEY_Y2} stroke={stroke} strokeWidth={sw} />
      {/* Left free-throw arc (upper) */}
      <path
        d={`M ${KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 1 ${KEY_W} ${KEY_Y2}`}
        fill="none" stroke={stroke} strokeWidth={sw}
      />
      {/* Left free-throw arc (lower dashed) */}
      <path
        d={`M ${KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 0 ${KEY_W} ${KEY_Y2}`}
        fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="5 4"
      />
      {/* Left corner 3-pt lines */}
      <line x1={0} y1={22} x2={92} y2={22} stroke={stroke} strokeWidth={sw} />
      <line x1={0} y1={CH - 22} x2={92} y2={CH - 22} stroke={stroke} strokeWidth={sw} />
      {/* Left 3-pt arc */}
      <path
        d={`M 92 22 A ${THREE_R} ${THREE_R} 0 0 1 92 ${CH - 22}`}
        fill="none" stroke={stroke} strokeWidth={sw}
      />
      {/* Left basket */}
      <circle cx={BASKET_X_L} cy={CY} r={7} fill="none" stroke={stroke} strokeWidth={sw} />
      {/* Left backboard */}
      <line x1={8} y1={CY - 20} x2={8} y2={CY + 20} stroke={stroke} strokeWidth={3} />
      {/* Left lane marks */}
      {[0.25, 0.45, 0.65, 0.85].map((f) => (
        <React.Fragment key={f}>
          <line x1={KEY_W * f} y1={KEY_Y1} x2={KEY_W * f} y2={KEY_Y1 - 6} stroke={stroke} strokeWidth={sw} />
          <line x1={KEY_W * f} y1={KEY_Y2} x2={KEY_W * f} y2={KEY_Y2 + 6} stroke={stroke} strokeWidth={sw} />
        </React.Fragment>
      ))}

      {/* === RIGHT SIDE (mirror) === */}
      <rect x={CW - KEY_W} y={KEY_Y1} width={KEY_W} height={KEY_H} fill="none" stroke={stroke} strokeWidth={sw} />
      <line x1={CW - KEY_W} y1={KEY_Y1} x2={CW - KEY_W} y2={KEY_Y2} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${CW - KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 0 ${CW - KEY_W} ${KEY_Y2}`}
        fill="none" stroke={stroke} strokeWidth={sw}
      />
      <path
        d={`M ${CW - KEY_W} ${KEY_Y1} A ${FT_R} ${FT_R} 0 0 1 ${CW - KEY_W} ${KEY_Y2}`}
        fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray="5 4"
      />
      <line x1={CW} y1={22} x2={CW - 92} y2={22} stroke={stroke} strokeWidth={sw} />
      <line x1={CW} y1={CH - 22} x2={CW - 92} y2={CH - 22} stroke={stroke} strokeWidth={sw} />
      <path
        d={`M ${CW - 92} 22 A ${THREE_R} ${THREE_R} 0 0 0 ${CW - 92} ${CH - 22}`}
        fill="none" stroke={stroke} strokeWidth={sw}
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
  const [swapped, setSwapped] = useState(false);
  const [courtType, setCourtType] = useState<1 | 2>(1);

  // Which colour/label is on which side based on swap state
  const leftColor  = swapped ? TEAM_2_COLOR : TEAM_1_COLOR;
  const rightColor = swapped ? TEAM_1_COLOR : TEAM_2_COLOR;
  const leftLabel  = swapped ? 'TEAM 2' : 'TEAM 1';
  const rightLabel = swapped ? 'TEAM 1' : 'TEAM 2';

  // Type 1: each team attacks toward their own side's basket
  // Type 2: teams attack toward the opposite basket (arrows flip inward)
  const leftDir:  'left' | 'right' = courtType === 1 ? 'left'  : 'right';
  const rightDir: 'left' | 'right' = courtType === 1 ? 'right' : 'left';

  return (
    <div className="h-screen bg-[#F0F2F5] flex flex-col overflow-hidden">
      {/* Back — fixed top left */}
      <div className="fixed top-4 left-6 z-10">
        <button
          onClick={() => navigate('/starters')}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
        >
          <FiArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {/* Continue — fixed top right */}
      <div className="fixed top-4 right-6 z-10">
        <button
          onClick={() => navigate('/jump-ball')}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
        >
          <FiArrowRight size={16} />
          <span>Continue</span>
        </button>
      </div>

      {/* Title */}
      <div className="pt-5 pb-3 text-center shrink-0">
        <h1 className="text-xl font-bold text-blue-700">Choose Shooting Sides</h1>
      </div>

      {/* Main content — fills remaining height between title and bottom bar */}
      <div className="flex flex-1 items-center justify-center px-6 gap-6 overflow-hidden">
        {/* Type selector */}
        <div className="flex flex-col gap-3 shrink-0">
          {([1, 2] as const).map((t) => (
            <label
              key={t}
              className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700"
            >
              <span>Type {t}</span>
              <button
                type="button"
                onClick={() => setCourtType(t)}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  courtType === t ? 'border-blue-600' : 'border-gray-400'
                }`}
              >
                {courtType === t && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 block" />
                )}
              </button>
            </label>
          ))}
        </div>

        {/* Court + labels — scales to fill available space */}
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <div className="w-full rounded-xl overflow-hidden shadow border border-gray-300 bg-white">
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
                <circle cx={CX} cy={CY} r={26} fill="#1a1a2e" />
                <text
                  x={CX}
                  y={CY + 6}
                  textAnchor="middle"
                  fontSize="18"
                  fill="white"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  ⇄
                </text>
              </g>
            </svg>
          </div>

          {/* Team labels */}
          <div className="flex justify-between w-full px-1">
            <span
              className="text-white text-xs font-bold px-4 py-1 rounded"
              style={{ backgroundColor: leftColor }}
            >
              {leftLabel}
            </span>
            <span
              className="text-white text-xs font-bold px-4 py-1 rounded"
              style={{ backgroundColor: rightColor }}
            >
              {rightLabel}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChooseSides;
