import React from 'react';
import { cl } from '../utils/cl';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';
import { isLightColor, normalizeHex } from '../../../contexts/StatisticianTeamColorsContext';

export interface TeamScorecardProps {
  teamName: string;
  score: number;
  accentColor: string;
  accentSide: 'left' | 'right';
}

const TeamScorecard: React.FC<TeamScorecardProps> = ({
  teamName,
  score,
  accentColor,
  accentSide,
}) => {
  const accentPx = cl('5px', '0.5vw', '7px');
  const normalizedAccent = normalizeHex(accentColor) ?? accentColor;
  // Very light jersey colors (e.g. pale yellow) read poorly as text on a white card —
  // fall back to a dark neutral so the score stays legible while the border still shows the real color.
  const scoreColor = isLightColor(normalizedAccent) ? '#111827' : normalizedAccent;
  const accentBorder =
    accentSide === 'left'
      ? { borderLeft: `${accentPx} solid ${accentColor}` as const }
      : { borderRight: `${accentPx} solid ${accentColor}` as const };

  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white font-sans"
      style={{
        ...accentBorder,
        padding: `${cl('8px', '1.1vh', '14px')} ${cl('8px', '1vw', '16px')}`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: '55%',
          background: `linear-gradient(to bottom, ${accentColor}14, transparent)`,
        }}
      />
      <div
        className="relative font-semibold uppercase text-gray-500"
        style={{
          fontSize: cl('11px', '1.05vw', '15px'),
          letterSpacing: 2,
        }}
      >
        {teamName}
      </div>
      <div
        className="relative leading-none tabular-nums"
        style={{
          fontFamily: GATEWAY_DISPLAY_FONT_STACK,
          fontSize: cl('28px', '3.4vw', '46px'),
          marginTop: cl('2px', '0.3vh', '4px'),
          color: scoreColor,
        }}
        aria-live="polite"
      >
        {score}
      </div>
    </div>
  );
};

export default TeamScorecard;
