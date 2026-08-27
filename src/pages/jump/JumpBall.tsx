import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import StatisticianLayout from '../../components/StatisticianLayout';
import {
  jerseyAccentSurfaceStyle,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
import { readGameSetupOrientation } from '../gameSetupOrientation';
import { writeJumpBallWinnerTeamId } from '../jumpBallWinner';
import { readStoredSessionContext } from '../../features/statdash/sessionContextStorage';

const PLAYERS = [1, 2, 3, 4, 5] as const;

const PlayerBtn: React.FC<{
  num: number;
  selected: boolean;
  onClick: () => void;
}> = ({ num, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-[72px] w-[72px] select-none rounded text-3xl font-bold transition-all ${
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
    className={`flex h-[80px] w-[80px] items-center justify-center rounded text-3xl font-bold transition-all ${
      num !== null ? 'bg-gray-500 text-white shadow' : 'bg-transparent'
    }`}
  >
    {num ?? ''}
  </div>
);

const JumpBall: React.FC = () => {
  const navigate = useNavigate();
  const { homeTeamColor, awayTeamColor } = useStatisticianTeamColors();
  const [team1Pick, setTeam1Pick] = useState<number | null>(null);
  const [team2Pick, setTeam2Pick] = useState<number | null>(null);
  const [winner, setWinner] = useState<'left' | 'right' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { homeOnLeft } = readGameSetupOrientation();

  const team1Color = homeTeamColor;
  const team2Color = awayTeamColor;
  const leftBadgeLabel = homeOnLeft ? 'TEAM 1' : 'TEAM 2';
  const rightBadgeLabel = homeOnLeft ? 'TEAM 2' : 'TEAM 1';
  const leftBadgeColor = homeOnLeft ? team1Color : team2Color;
  const rightBadgeColor = homeOnLeft ? team2Color : team1Color;

  useEffect(() => {
    if (!readStoredSessionContext()) {
      navigate('/match-key', { replace: true });
    }
  }, [navigate]);

  const handleTeam1Pick = (n: number) => setTeam1Pick((prev) => (prev === n ? null : n));

  const handleTeam2Pick = (n: number) => setTeam2Pick((prev) => (prev === n ? null : n));

  const selectWinner = async (w: 'left' | 'right') => {
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsSaving(true);
    setWinner(w);
    // 'left'/'right' is a court side, not a team — resolve it against the chosen
    // orientation so StatDash can send the real winningTeamId to the backend.
    const winnerIsHome = w === 'left' ? homeOnLeft : !homeOnLeft;
    const winningTeamId = winnerIsHome ? context.homeTeamId : context.awayTeamId;
    if (winningTeamId) writeJumpBallWinnerTeamId(winningTeamId);
    setIsSaving(false);
  };

  return (
    <StatisticianLayout>
      <div className="flex min-h-0 flex-1 flex-col bg-[#F0F2F5] font-sans">
        <div className="flex shrink-0 items-center justify-between px-6 py-3">
          <button
            type="button"
            onClick={() => navigate('/choose-sides')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
          >
            <FiArrowLeft size={16} />
            <span>Back</span>
          </button>
          {winner !== null && !isSaving && (
            <button
              type="button"
              onClick={() => navigate('/stat-dash')}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
            >
              <span>Continue</span>
              <FiArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="pb-8 pt-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Select Players for Jump Ball</h1>
        </div>

        <div className="flex flex-col items-center gap-8 px-8 pb-8">
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 rounded px-3 py-2 text-xs font-bold"
              style={jerseyAccentSurfaceStyle(leftBadgeColor)}
            >
              {leftBadgeLabel}
            </span>

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

            <div className="w-10" />

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

            <span
              className="shrink-0 rounded px-3 py-2 text-xs font-bold"
              style={jerseyAccentSurfaceStyle(rightBadgeColor)}
            >
              {rightBadgeLabel}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <SelectedTile num={team1Pick} />
            <SelectedTile num={team2Pick} />
          </div>

          <div className="flex flex-col items-center gap-5">
            <p className="text-base font-semibold text-gray-800">Select Team that Won the Jump Ball</p>
            <div className="flex items-center gap-6">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => selectWinner('left')}
                className={`rounded px-10 py-2.5 text-sm font-bold transition-all ${
                  winner === 'left'
                    ? 'scale-105 opacity-100 ring-4 ring-offset-2 ring-gray-400'
                    : 'opacity-90 hover:opacity-100'
                }`}
                style={jerseyAccentSurfaceStyle(leftBadgeColor)}
              >
                {leftBadgeLabel}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => selectWinner('right')}
                className={`rounded px-10 py-2.5 text-sm font-bold transition-all ${
                  winner === 'right'
                    ? 'scale-105 opacity-100 ring-4 ring-offset-2 ring-gray-400'
                    : 'opacity-90 hover:opacity-100'
                }`}
                style={jerseyAccentSurfaceStyle(rightBadgeColor)}
              >
                {rightBadgeLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default JumpBall;
