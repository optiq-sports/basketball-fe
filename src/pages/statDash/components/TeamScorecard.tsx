import React from 'react';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

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
  const accentPx = cl('4px', '0.45vw', '6px');
  const accentBorder =
    accentSide === 'left'
      ? { borderLeft: `${accentPx} solid ${accentColor}` as const }
      : { borderRight: `${accentPx} solid ${accentColor}` as const };

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center rounded-lg bg-white font-sans shadow-sm"
      style={{
        border: `1px solid ${STAT_DASH.cardBorder}`,
        ...accentBorder,
        padding: `${cl('10px', '1.8vh', '22px')} ${cl('8px', '1vw', '16px')}`,
      }}
    >
      <div
        className="font-semibold uppercase text-gray-900"
        style={{
          fontSize: cl('13px', '1.4vw', '22px'),
          letterSpacing: 2,
        }}
      >
        {teamName}
      </div>
      <div
        className="font-bold leading-tight tabular-nums text-gray-900"
        style={{
          fontSize: cl('32px', '4.2vw', '60px'),
        }}
        aria-live="polite"
      >
        {score}
      </div>
    </div>
  );
};

export default TeamScorecard;
