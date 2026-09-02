import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCheck } from 'react-icons/fi';
import StatisticianLayout from '../../components/StatisticianLayout';
import {
  getContrastTextColor,
  isLightColor,
  jerseyAccentSurfaceStyle,
  normalizeHex,
  useStatisticianTeamColors,
} from '../../contexts/StatisticianTeamColorsContext';
import { readGameSetupOrientation } from '../gameSetupOrientation';
import { writeJumpBallWinnerTeamId } from '../jumpBallWinner';
import { readStoredSessionContext } from '../../features/statdash/sessionContextStorage';
import { GATEWAY_DISPLAY_FONT_STACK, GATEWAY_FONT_STACK } from '../../authGatewayTheme';

const PLAYERS = [1, 2, 3, 4, 5] as const;

const JerseyTile: React.FC<{
  num: number;
  color: string;
  selected: boolean;
  onClick: () => void;
}> = ({ num, color, selected, onClick }) => {
  const normalized = normalizeHex(color) ?? '#3B82F6';
  const safe = isLightColor(normalized) ? '#334155' : normalized;
  const fg = getContrastTextColor(safe);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-14 w-14 select-none items-center justify-center rounded-lg text-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected ? 'scale-105' : 'hover:scale-105'
      }`}
      style={{
        fontFamily: GATEWAY_DISPLAY_FONT_STACK,
        backgroundColor: selected ? safe : '#F1F5F9',
        color: selected ? fg : '#64748B',
        boxShadow: selected ? `0 6px 14px -5px ${safe}99` : 'inset 0 0 0 1px rgba(15,23,42,0.08)',
      }}
    >
      {num}
    </button>
  );
};

const TeamPanel: React.FC<{
  label: string;
  color: string;
  picks: number | null;
  onPick: (n: number) => void;
}> = ({ label, color, picks, onPick }) => (
  <div className="flex min-w-0 flex-col items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-5 sm:px-5">
    <span
      className="rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wide"
      style={jerseyAccentSurfaceStyle(color)}
    >
      {label}
    </span>
    <div className="flex gap-1.5 sm:gap-2">
      {PLAYERS.map((n) => (
        <JerseyTile key={n} num={n} color={color} selected={picks === n} onClick={() => onPick(n)} />
      ))}
    </div>
  </div>
);

const BasketballGlyph: React.FC = () => (
  <svg width={56} height={56} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx={32} cy={32} r={29} fill="#EA580C" stroke="#111827" strokeWidth={2} />
    <path d="M3 32 H61" stroke="#111827" strokeWidth={2} />
    <path d="M32 3 V61" stroke="#111827" strokeWidth={2} />
    <path d="M9 11 Q30 32 9 53" fill="none" stroke="#111827" strokeWidth={2} />
    <path d="M55 11 Q34 32 55 53" fill="none" stroke="#111827" strokeWidth={2} />
  </svg>
);

const WinnerButton: React.FC<{
  label: string;
  color: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ label, color, selected, disabled, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center gap-2 rounded-lg px-9 py-3 text-sm font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed ${
      selected ? 'scale-105 ring-2 ring-offset-2 ring-gray-900' : 'opacity-90 hover:opacity-100 hover:scale-[1.02]'
    }`}
    style={jerseyAccentSurfaceStyle(color)}
  >
    {selected && <FiCheck size={16} strokeWidth={3} />}
    {label}
  </button>
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
            onClick={() => navigate('/choose-sides')}
            className="flex items-center gap-1.5 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <FiArrowLeft size={15} />
            Back
          </button>
          <button
            type="button"
            disabled={winner === null || isSaving}
            onClick={() => navigate('/stat-dash')}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            Continue
            <FiArrowRight size={16} />
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 sm:px-8">
          <div className="mb-6 text-center sm:mb-8">
            <h1
              className="text-[2.1rem] leading-none text-gray-900 sm:text-[2.4rem]"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK }}
            >
              Jump ball
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Pick who&rsquo;s jumping for each team, then mark who controls the tip.
            </p>
          </div>

          <div className="flex w-full max-w-4xl flex-col items-center gap-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.3)] sm:p-8">
            <div className="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <TeamPanel label={leftBadgeLabel} color={leftBadgeColor} picks={team1Pick} onPick={handleTeam1Pick} />
              <div className="flex items-center justify-center">
                <BasketballGlyph />
              </div>
              <TeamPanel label={rightBadgeLabel} color={rightBadgeColor} picks={team2Pick} onPick={handleTeam2Pick} />
            </div>

            <div className="flex w-full flex-col items-center gap-4 border-t border-gray-100 pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Who won the tip?</p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <WinnerButton
                  label={leftBadgeLabel}
                  color={leftBadgeColor}
                  selected={winner === 'left'}
                  disabled={isSaving}
                  onClick={() => selectWinner('left')}
                />
                <WinnerButton
                  label={rightBadgeLabel}
                  color={rightBadgeColor}
                  selected={winner === 'right'}
                  disabled={isSaving}
                  onClick={() => selectWinner('right')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default JumpBall;
