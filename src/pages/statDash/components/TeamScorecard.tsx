import React from 'react';
import { cl } from '../utils/cl';

export interface TeamScorecardProps {
  teamName: string;
  score: number;
  borderColor: string;
}

const TeamScorecard: React.FC<TeamScorecardProps> = ({ teamName, score, borderColor }) => {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center rounded-md bg-white font-sans"
      style={{
        border: `3px solid ${borderColor}`,
        padding: `${cl('10px', '1.8vh', '22px')} 0`,
      }}
    >
      <div
        className="font-bold uppercase"
        style={{
          fontSize: cl('13px', '1.4vw', '22px'),
          letterSpacing: 2,
        }}
      >
        {teamName}
      </div>
      <div
        className="font-bold leading-tight tabular-nums"
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
