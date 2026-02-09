import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile, useTournaments, useMatches, useTeams } from '../../api/hooks';
import type { Match as MatchType } from '../../types/api';

const PlusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="8" x2="12" y2="16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LocationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
);

const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2}/>
    <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} strokeLinecap="round"/>
    <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} strokeLinecap="round"/>
    <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2}/>
  </svg>
);

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
  </svg>
);

function formatMatchDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function getTeamName(teamMap: Map<string, string>, teamId: string): string {
  return teamMap.get(teamId) ?? teamId;
}

const RECENT_GAMES_LIMIT = 5;

const BasketballDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const profile = useProfile();
  const teamsQuery = useTeams();
  const liveMatches = useMatches(undefined, 'LIVE');
  const scheduledMatches = useMatches(undefined, 'SCHEDULED');
  const completedMatches = useMatches(undefined, 'COMPLETED');
  const tournamentsQuery = useTournaments();

  const teamMap = useMemo(() => {
    const list = teamsQuery.data ?? [];
    const map = new Map<string, string>();
    list.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const profileData = profile.data as { name?: string; email?: string } | undefined;
  const welcomeName = profileData?.name ?? profileData?.email ?? 'User';

  const liveList = liveMatches.data ?? [];
  const scheduledList = scheduledMatches.data ?? [];
  const recentList = (completedMatches.data ?? []).slice(0, RECENT_GAMES_LIMIT);
  const tournamentsList = tournamentsQuery.data ?? [];

  const upNextGames = scheduledList;
  const hasUpNext = upNextGames.length > 0;
  const currentSlideIndex = hasUpNext ? Math.min(currentSlide, upNextGames.length - 1) : 0;
  const currentUpNext = hasUpNext ? upNextGames[currentSlideIndex] : null;

  const nextSlide = () => {
    if (!hasUpNext) return;
    setCurrentSlide((prev) => (prev + 1) % upNextGames.length);
  };

  const prevSlide = () => {
    if (!hasUpNext) return;
    setCurrentSlide((prev) => (prev - 1 + upNextGames.length) % upNextGames.length);
  };

  const handleStartNew = () => {
    navigate('/start-new');
  };

  const ongoingMatch = liveList[0];

  const hasError =
    profile.error || teamsQuery.error || liveMatches.error || completedMatches.error || tournamentsQuery.error;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl text-gray-700">
            Welcome back{' '}
            <span className="font-bold text-gray-900">
              {profile.isPending ? '...' : welcomeName}
            </span>
          </h1>
          <button
            onClick={handleStartNew}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <PlusCircleIcon className="w-5 h-5" />
            <span>Start New</span>
          </button>
        </div>

        {hasError && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {profile.error?.message ??
              teamsQuery.error?.message ??
              liveMatches.error?.message ??
              completedMatches.error?.message ??
              tournamentsQuery.error?.message ??
              'Failed to load some data'}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Ongoing Game */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Ongoing Game</h2>
              {liveMatches.isPending ? (
                <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : ongoingMatch ? (
                <div
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() =>
                    navigate(`/tournaments/${ongoingMatch.tournamentId}/match/${ongoingMatch.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center">
                        <img src="/ball1.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          {getTeamName(teamMap, ongoingMatch.homeTeamId)}
                        </div>
                        <div className="text-3xl font-bold text-gray-900">
                          {ongoingMatch.totalHome ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 font-medium">VS</div>
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1 text-right">
                          {getTeamName(teamMap, ongoingMatch.awayTeamId)}
                        </div>
                        <div className="text-3xl font-bold text-gray-900">
                          {ongoingMatch.totalAway ?? 0}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-400">
                    {ongoingMatch.venue ?? '—'} | {formatMatchDate(ongoingMatch.scheduledDate)}
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-gray-500 text-sm">No live game</div>
              )}
            </div>

            {/* Up Next Carousel */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Up Next</h2>
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View all
                </button>
              </div>
              {scheduledMatches.isPending ? (
                <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : hasUpNext && currentUpNext ? (
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={prevSlide}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <div
                      className="flex-1 mx-4 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        navigate(
                          `/tournaments/${currentUpNext.tournamentId}/match/${currentUpNext.id}/pending`
                        )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center">
                            <img src="/ball1.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          </div>
                          <div className="text-sm text-gray-600">
                            {getTeamName(teamMap, currentUpNext.homeTeamId)}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 font-medium">VS</div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-600">
                            {getTeamName(teamMap, currentUpNext.awayTeamId)}
                          </div>
                          <div className="flex items-center justify-center">
                            <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-400">
                        {currentUpNext.venue ?? '—'} | {formatMatchDate(currentUpNext.scheduledDate)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={nextSlide}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex justify-center gap-1.5 mt-4">
                    {upNextGames.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentSlide(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          idx === currentSlideIndex ? 'bg-gray-800' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-gray-500 text-sm">No upcoming matches</div>
              )}
            </div>

            {/* Up Coming Tournaments */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Upcoming Tournament / Leagues</h2>
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View All
                </button>
              </div>
              {tournamentsQuery.isPending ? (
                <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : tournamentsList.length > 0 ? (
                <div className="space-y-3">
                  {tournamentsList.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <img
                        src="/club.png"
                        alt="Tournament"
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm mb-1">{tournament.name}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <LocationIcon className="w-3 h-3" />
                            {tournament.venue ?? '—'}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {tournament.division ?? 'TBA'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-gray-500 text-sm">No tournaments</div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* New Game Setup Card */}
            <div
              className="rounded-2xl p-6 shadow-lg relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(90deg, #9BD9E6 -102.62%, #93D0E1 -73.81%, #80B7D5 -23.41%, #608FC1 36.59%, #3559A6 108.59%, #21409A 137.39%)',
              }}
            >
              <div className="relative z-10">
                <div className="text-xs text-white/80 font-medium mb-2">New Game setup</div>
                <h3 className="text-lg text-white font-semibold mb-4">
                  Start a new tournament, league, or
                  <br />
                  friendly competition
                </h3>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="bg-white text-[#3F3F3F] px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  Game Setup
                </button>
              </div>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-[262px] h-[262px]">
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src="/champ.png" alt="Trophy" className="w-[262px] h-[262px] object-contain" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Games */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Recent Games</h2>
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View All
                </button>
              </div>
              {completedMatches.isPending ? (
                <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              ) : recentList.length > 0 ? (
                <div className="space-y-3">
                  {recentList.map((game: MatchType) => (
                    <div
                      key={game.id}
                      className="bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() =>
                        navigate(`/tournaments/${game.tournamentId}/match/${game.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center">
                            <img src="/ball1.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          </div>
                          <span className="text-sm text-gray-600">
                            {getTeamName(teamMap, game.homeTeamId)} -{' '}
                            <span className="font-semibold text-gray-900">{game.totalHome ?? 0}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center">
                            <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          </div>
                          <span className="text-sm text-gray-600">
                            {getTeamName(teamMap, game.awayTeamId)} -{' '}
                            <span className="font-semibold text-gray-900">{game.totalAway ?? 0}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 border-t border-gray-200 pt-2">
                        <div>{game.venue ?? '—'}</div>
                        <div>{formatMatchDate(game.scheduledDate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No recent games</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasketballDashboard;
