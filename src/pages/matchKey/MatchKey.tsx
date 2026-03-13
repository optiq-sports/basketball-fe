import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMatches, useTeams, useProfile } from '../../api/hooks';

const MatchKey: React.FC = () => {
  const [matchKey, setMatchKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { data: matches } = useMatches();
  const { data: teams } = useTeams();
  const { data: profileData, isLoading: profileLoading } = useProfile();

  const role = (profileData as { role?: string } | undefined)?.role;
  const userName =
    (profileData as { name?: string } | undefined)?.name?.trim() || 'Statistician';

  // Once profile is loaded, non-statisticians don't belong here
  if (!profileLoading && role && role !== 'STATISTICIAN') {
    return <Navigate to="/dashboard" replace />;
  }

  const teamMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    (teams ?? []).forEach((t) => {
      map[t.id] = { name: t.name, color: t.color };
    });
    return map;
  }, [teams]);

  const recentMatches = useMemo(() => {
    return [...(matches ?? [])]
      .sort(
        (a, b) =>
          new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
      )
      .slice(0, 5);
  }, [matches]);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const key = matchKey.trim();
    if (!key) {
      setError('Please enter a Match Key.');
      return;
    }
    navigate('/starters');
  };

  const formatMatchDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getTeamIconStyle = (color: string | undefined) => {
    if (!color) return { backgroundColor: '#F59E0B' };
    const hex = color.startsWith('#') ? color : `#${color}`;
    return { backgroundColor: hex };
  };

  return (
    <div className="min-h-screen w-full bg-[#F5FCFF] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* App Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(145deg, #4A90D9 0%, #1D4E8F 100%)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 4L28 16L16 28L4 16L16 4Z"
                fill="white"
                opacity="0.95"
              />
              <path
                d="M16 8L24 16L16 24L8 16L16 8Z"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.5"
              />
            </svg>
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-8">
          <h1 className="text-3xl text-gray-700 mb-2">
            Welcome back <span className="font-bold text-gray-900">{userName}</span>
          </h1>
          <p className="text-sm text-gray-600">
            Enter <span className="font-semibold text-gray-900">Match Key</span> to proceed to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleContinue} className="space-y-3">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Match Key"
            value={matchKey}
            onChange={(e) => {
              setMatchKey(e.target.value);
              if (error) setError('');
            }}
            className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 text-base placeholder-gray-500"
          />

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl transition-all text-base"
          >
            Continue
          </button>
        </form>

        {/* Recent Games */}
        {recentMatches.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold text-gray-700">Recent Games</p>
            </div>

            <div className="max-h-56 overflow-y-auto">
              {recentMatches.map((match, index) => {
                const homeTeam = teamMap[match.homeTeamId];
                const awayTeam = teamMap[match.awayTeamId];
                const homeName = homeTeam?.name ?? match.homeTeamId;
                const awayName = awayTeam?.name ?? match.awayTeamId;
                const homeScore = match.totalHome ?? 0;
                const awayScore = match.totalAway ?? 0;

                return (
                  <div
                    key={match.id}
                    onClick={() =>
                      navigate(`/tournaments/${match.tournamentId}/match/${match.id}`)
                    }
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                      index < recentMatches.length - 1
                        ? 'border-b border-gray-100'
                        : ''
                    }`}
                  >
                    {/* Teams */}
                    <div className="flex flex-col gap-1.5">
                      {/* Home Team */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                          style={getTeamIconStyle(homeTeam?.color)}
                        >
                          <span className="text-white font-bold text-xs">
                            {homeName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-800 uppercase tracking-wide">
                          {homeName} - {homeScore}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                          style={getTeamIconStyle(awayTeam?.color ?? '#0D9488')}
                        >
                          <span className="text-white font-bold text-xs">
                            {awayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-800 uppercase tracking-wide">
                          {awayName} - {awayScore}
                        </span>
                      </div>
                    </div>

                    {/* Venue & Date */}
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-gray-500 font-medium">
                        {match.venue ?? 'Match Venue'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatMatchDate(match.scheduledDate)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchKey;
