import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';

const TEAM_1_COLOR = '#E63946';
const TEAM_2_COLOR = '#D4A017';
const PLAYERS = [1, 2, 3, 4, 5] as const;

const PlayerBtn: React.FC<{
  num: number;
  selected: boolean;
  onClick: () => void;
}> = ({ num, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-[72px] h-[72px] rounded text-3xl font-bold transition-all select-none ${
      selected
        ? 'bg-gray-500 text-white shadow-inner'
        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    }`}
  >
    {num}
  </button>
);

const SelectedTile: React.FC<{ num: number | null }> = ({ num }) => (
  <div
    className={`w-[80px] h-[80px] rounded flex items-center justify-center text-3xl font-bold transition-all ${
      num !== null ? 'bg-gray-500 text-white shadow' : 'bg-transparent'
    }`}
  >
    {num ?? ''}
  </div>
);

const JumpBall: React.FC = () => {
  const navigate = useNavigate();
  const [team1Pick, setTeam1Pick] = useState<number | null>(null);
  const [team2Pick, setTeam2Pick] = useState<number | null>(null);
  const [winner, setWinner] = useState<'team1' | 'team2' | null>(null);

  const canContinue = team1Pick !== null && team2Pick !== null && winner !== null;

  const handleTeam1Pick = (n: number) =>
    setTeam1Pick((prev) => (prev === n ? null : n));

  const handleTeam2Pick = (n: number) =>
    setTeam2Pick((prev) => (prev === n ? null : n));

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col">
      {/* Back — fixed top left */}
      <div className="fixed top-4 left-6 z-10">
        <button
          onClick={() => navigate('/choose-sides')}
          className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
        >
          <FiArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {/* Continue — fixed top right, only after a winner is picked */}
      {winner !== null && (
        <div className="fixed top-4 right-6 z-10">
          <button
            onClick={() => navigate('/stat-dash')}
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            <FiArrowRight size={16} />
            <span>Continue</span>
          </button>
        </div>
      )}

      {/* Title */}
      <div className="pt-10 pb-8 text-center">
        <h1 className="text-2xl font-bold text-blue-700">
          Select Players for Jump Ball
        </h1>
      </div>

      {/* Content area */}
      <div className="flex flex-col items-center gap-8 px-8 pb-8">
        {/* Player selector row */}
        <div className="flex items-center gap-3">
          {/* Team 1 label */}
          <span
            className="text-white text-xs font-bold px-3 py-2 rounded shrink-0"
            style={{ backgroundColor: TEAM_1_COLOR }}
          >
            TEAM 1
          </span>

          {/* Team 1 buttons */}
          <div className="flex gap-2">
            {PLAYERS.map((n) => (
              <PlayerBtn
                key={n}
                num={n}
                selected={team1Pick === n}
                onClick={() => handleTeam1Pick(n)}
              />
            ))}
          </div>

          {/* Centre gap */}
          <div className="w-10" />

          {/* Team 2 buttons */}
          <div className="flex gap-2">
            {PLAYERS.map((n) => (
              <PlayerBtn
                key={n}
                num={n}
                selected={team2Pick === n}
                onClick={() => handleTeam2Pick(n)}
              />
            ))}
          </div>

          {/* Team 2 label */}
          <span
            className="text-white text-xs font-bold px-3 py-2 rounded shrink-0"
            style={{ backgroundColor: TEAM_2_COLOR }}
          >
            TEAM 2
          </span>
        </div>

        {/* Selected player tiles */}
        <div className="flex items-center gap-4">
          <SelectedTile num={team1Pick} />
          <SelectedTile num={team2Pick} />
        </div>

        {/* Jump ball winner */}
        <div className="flex flex-col items-center gap-5">
          <p className="text-base font-semibold text-gray-800">
            Select Team that Won the Jump Ball
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setWinner('team1')}
              className={`px-10 py-2.5 rounded font-bold text-white text-sm transition-all ${
                winner === 'team1'
                  ? 'opacity-100 ring-4 ring-offset-2 ring-red-300 scale-105'
                  : 'opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: TEAM_1_COLOR }}
            >
              TEAM 1
            </button>
            <button
              type="button"
              onClick={() => setWinner('team2')}
              className={`px-10 py-2.5 rounded font-bold text-white text-sm transition-all ${
                winner === 'team2'
                  ? 'opacity-100 ring-4 ring-offset-2 ring-yellow-300 scale-105'
                  : 'opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: TEAM_2_COLOR }}
            >
              TEAM 2
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default JumpBall;
