import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatch, useUpdateMatch, useStatisticians } from '../../api/hooks';
import type { MatchStatus, Statistician } from '../../types/api';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
import { useToast } from '../../hooks/useToast';

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(scheduledDate: string | undefined): TimeLeft {
  if (!scheduledDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const diff = new Date(scheduledDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function getStatName(stat: Statistician): string {
  const profile = stat.profile as { fullName?: string } | undefined;
  return stat.name ?? profile?.fullName ?? stat.email ?? 'Unknown';
}

function getStatLocation(stat: Statistician): string {
  const profile = stat.profile as { state?: string; country?: string } | undefined;
  return [profile?.state, profile?.country].filter(Boolean).join(', ') || '—';
}

function getStatPhoto(stat: Statistician): string {
  const profile = stat.profile as { photos?: string[] } | undefined;
  return resolvePlayerPhotoUrl(profile?.photos?.[0], stat.id);
}

function formatScheduledDate(scheduledDate: string): string {
  try {
    return new Date(scheduledDate).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return scheduledDate;
  }
}

const PendingGames: React.FC = () => {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate = useNavigate();
  const matchQuery = useMatch(matchId);
  const updateMatch = useUpdateMatch();
  const toast = useToast();

  const match = matchQuery.data;
  const statisticiansQuery = useStatisticians();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(match?.scheduledDate));
  const [confirmStatus, setConfirmStatus] = useState<MatchStatus | null>(null);
  const [selectedStatistician, setSelectedStatistician] = useState('');

  useEffect(() => {
    if (!match?.scheduledDate) return;
    setTimeLeft(getTimeLeft(match.scheduledDate));
    const timer = setInterval(() => setTimeLeft(getTimeLeft(match.scheduledDate)), 1000);
    return () => clearInterval(timer);
  }, [match?.scheduledDate]);

  const handleCopyCode = () => {
    const code = match?.matchCode ?? matchId ?? '';
    navigator.clipboard.writeText(code);
    toast.success('Match code copied!');
  };

  const handleStatusUpdate = (status: MatchStatus) => {
    if (!matchId) return;
    updateMatch.mutate(
      { id: matchId, data: { status } },
      {
        onSuccess: () => {
          setConfirmStatus(null);
          navigate(`/tournaments/${id}`);
        },
      },
    );
  };

  if (matchQuery.isPending) {
    return <div className="min-h-screen bg-white p-6 flex items-center justify-center text-gray-500">Loading match…</div>;
  }

  if (matchQuery.isError || !match) {
    return <div className="min-h-screen bg-white p-6 flex items-center justify-center text-red-500">Failed to load match.</div>;
  }

  const homeTeamName = match.homeTeam?.name ?? 'Home Team';
  const awayTeamName = match.awayTeam?.name ?? 'Away Team';
  const tournamentName = match.tournament?.name ?? 'Tournament';
  const matchCode = match.matchCode ?? matchId ?? '';
  const isPast = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  const statisticians: Statistician[] = statisticiansQuery.data ?? [];

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-800 flex items-center gap-2 cursor-pointer"
          >
            <span>←</span> Back
          </button>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <span>Copy Match Code</span>
            <CopyIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Teams */}
        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200 mb-6">
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg">
                <img src="/ball1.png" alt={homeTeamName} className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xl font-semibold text-gray-800">{homeTeamName}</span>
            </div>
            <span className="text-lg font-medium text-gray-500">VS</span>
            <div className="flex items-center gap-3">
              <span className="text-xl font-semibold text-gray-800">{awayTeamName}</span>
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <img src="/ball2.png" alt={awayTeamName} className="w-8 h-8 object-contain" />
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500">
            <p>{tournamentName} | {formatScheduledDate(match.scheduledDate)}</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex justify-center gap-4 mb-6">
          {[
            { label: 'Day(s)', value: timeLeft.days },
            { label: 'Hour(s)', value: timeLeft.hours },
            { label: 'Minute(s)', value: timeLeft.minutes },
            { label: 'Second(s)', value: timeLeft.seconds },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#21409A] rounded-lg p-6 text-center" style={{ width: '100px' }}>
              <div className="text-xs text-white mb-2">{label}</div>
              <div className="text-4xl font-bold text-white">{String(value).padStart(2, '0')}</div>
            </div>
          ))}
        </div>

        <div className="text-center text-gray-600 font-medium mb-6">
          {isPast ? 'Match time has passed' : 'To Jump ball'}
        </div>

        {/* Status actions — POSTPONE / CANCEL */}
        <div className="flex justify-center gap-3 mb-10">
          {confirmStatus ? (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-5 py-3">
              <span className="text-sm text-gray-700">
                Mark match as <strong>{confirmStatus === 'POSTPONED' ? 'Postponed' : 'Cancelled'}</strong>?
              </span>
              <button
                onClick={() => handleStatusUpdate(confirmStatus)}
                disabled={updateMatch.isPending}
                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                {updateMatch.isPending ? 'Saving…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmStatus(null)}
                className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmStatus('POSTPONED')}
                className="px-5 py-2 border border-yellow-500 text-yellow-600 rounded-lg text-sm font-medium hover:bg-yellow-50 cursor-pointer"
              >
                Postpone Match
              </button>
              <button
                onClick={() => setConfirmStatus('CANCELLED')}
                className="px-5 py-2 border border-red-400 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 cursor-pointer"
              >
                Cancel Match
              </button>
            </>
          )}
        </div>

        {/* Assign Statistician */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex gap-3 mb-6">
            <select
              value={selectedStatistician}
              onChange={e => setSelectedStatistician(e.target.value)}
              disabled={statisticiansQuery.isPending}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
            >
              <option value="">
                {statisticiansQuery.isPending ? 'Loading statisticians…' : 'Assign Statistician'}
              </option>
              {statisticians.map(stat => (
                <option key={stat.id} value={stat.id}>
                  {getStatName(stat)} — {getStatLocation(stat)}
                </option>
              ))}
            </select>
            {/* Save disabled: Match schema has no statisticianId field yet — backend update required */}
            <button
              disabled
              title="Statistician assignment save requires a backend schema update (statisticianId field on Match)"
              className="px-5 py-3 bg-[#21409A] text-white rounded-lg font-medium opacity-40 cursor-not-allowed"
            >
              Assign
            </button>
          </div>

          {statisticiansQuery.isError && (
            <p className="text-sm text-red-500 mb-4">Failed to load statisticians.</p>
          )}

          {statisticians.length > 0 && (
            <div className="mb-4">
              <p className="text-center text-sm text-gray-600 mb-6">Available statisticians</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            {statisticians.map(stat => (
              <div
                key={stat.id}
                className={`flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-colors ${
                  selectedStatistician === stat.id ? 'bg-blue-50 ring-1 ring-[#21409A]' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedStatistician(stat.id)}
              >
                <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src={getStatPhoto(stat)}
                    onError={handlePhotoLoadError(stat.id)}
                    alt={getStatName(stat)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{getStatName(stat)}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>📍</span>
                    <span className="truncate">{getStatLocation(stat)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingGames;
