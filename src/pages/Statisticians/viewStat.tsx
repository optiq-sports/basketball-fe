import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useStatistician } from '../../api/hooks';
import type { Statistician } from '../../types/api';

interface Game {
  id: number;
  teamA: string;
  teamAScore: number;
  teamAColor: string;
  teamB: string;
  teamBScore: number;
  teamBColor: string;
  venue: string;
  date: string;
  time: string;
  datetime: string;
}

function buildDisplayStatistician(stat: Statistician | undefined): {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  image: string;
  gamesRecorded: string;
  dob: string;
  status: string;
} {
  if (!stat) {
    return {
      fullName: '—',
      email: '—',
      phone: '—',
      location: '—',
      image: '/stat.png',
      gamesRecorded: '—',
      dob: '—',
      status: '—',
    };
  }

  const firstName = stat.firstName ?? stat.name ?? '';
  const lastName = stat.lastName ?? '';
  const nameBase = firstName && lastName ? `${firstName} ${lastName}` : (stat.name as string | undefined) ?? (stat.email as string | undefined) ?? '';
  const fullName = nameBase || '—';

  const loc =
    [stat.state as string | undefined, stat.country as string | undefined]
      .filter(Boolean)
      .join(', ') || '—';

  const profile = stat.profile as { photos?: string[] } | undefined;
  const primaryPhoto =
    profile?.photos?.[0] ??
    (stat as { photo?: string }).photo ??
    (stat.image as string | undefined);

  const gamesRecorded =
    (stat as { gamesRecorded?: number }).gamesRecorded != null
      ? String((stat as { gamesRecorded?: number }).gamesRecorded)
      : (stat as { matchesCount?: number }).matchesCount != null
      ? String((stat as { matchesCount?: number }).matchesCount)
      : '—';

  const dobDay = (stat as { dobDay?: number }).dobDay;
  const dobMonth = (stat as { dobMonth?: number }).dobMonth;
  const dobYear = (stat as { dobYear?: number }).dobYear;
  let dob = '—';
  if (dobDay && dobMonth && dobYear) {
    const d = new Date(dobYear, dobMonth - 1, dobDay);
    if (!Number.isNaN(d.getTime())) {
      dob = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  const status = (stat.status as string | undefined) ?? '—';

  return {
    fullName,
    email: stat.email ?? '—',
    phone: (stat.phone as string | undefined) ?? '—',
    location: loc,
    image: primaryPhoto ?? '/stat.png',
    gamesRecorded,
    dob,
    status,
  };
}

const ViewStat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const statQuery = useStatistician(id ?? null);

  if (!id) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Statistician not found</p>
          <button
            onClick={() => navigate('/statisticians')}
            className="mt-4 text-[#21409A] hover:underline"
          >
            Back to Statisticians
          </button>
        </div>
      </div>
    );
  }

  if (statQuery.isPending) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500">Loading statistician...</p>
        </div>
      </div>
    );
  }

  if (statQuery.error || !statQuery.data) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">
            {statQuery.error instanceof Error ? statQuery.error.message : 'Statistician not found'}
          </p>
          <button
            onClick={() => navigate('/statisticians')}
            className="mt-4 text-[#21409A] hover:underline"
          >
            Back to Statisticians
          </button>
        </div>
      </div>
    );
  }

  const display = buildDisplayStatistician(statQuery.data as Statistician);

  const games: Game[] = [
    {
      id: 1,
      teamA: 'TEAM A',
      teamAScore: 120,
      teamAColor: 'yellow',
      teamB: 'TEAM B',
      teamBScore: 98,
      teamBColor: 'blue',
      venue: 'Match Venue',
      date: '11 November 2025',
      time: '12:40PM',
      datetime: '12:40PM, 11 November 2025',
    },
    {
      id: 2,
      teamA: 'TEAM A',
      teamAScore: 120,
      teamAColor: 'yellow',
      teamB: 'TEAM B',
      teamBScore: 98,
      teamBColor: 'blue',
      venue: 'Match Venue',
      date: '11 November 2025',
      time: '12:40PM',
      datetime: '12:40PM, 11 November 2025',
    },
    {
      id: 3,
      teamA: 'TEAM A',
      teamAScore: 120,
      teamAColor: 'yellow',
      teamB: 'TEAM B',
      teamBScore: 98,
      teamBColor: 'blue',
      venue: 'Match Venue',
      date: '11 November 2025',
      time: '12:40PM',
      datetime: '12:40PM, 11 November 2025',
    },
    {
      id: 4,
      teamA: 'TEAM A',
      teamAScore: 120,
      teamAColor: 'yellow',
      teamB: 'TEAM B',
      teamBScore: 98,
      teamBColor: 'blue',
      venue: 'Match Venue',
      date: '11 November 2025',
      time: '12:40PM',
      datetime: '12:40PM, 11 November 2025',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div 
        className="relative bg-gradient-to-br from-blue-50 to-blue-100 pt-8 pb-12 px-8 overflow-hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M100 0 Q150 50 100 100 T100 200' stroke='white' stroke-width='2' fill='none' opacity='0.3'/%3E%3Cpath d='M0 100 Q50 150 100 100 T200 100' stroke='white' stroke-width='2' fill='none' opacity='0.3'/%3E%3C/svg%3E")`,
        }}
      >
        {/* Abstract curved lines background */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path d="M0,100 Q100,50 200,100 T400,100" stroke="white" strokeWidth="3" fill="none" opacity="0.5"/>
            <path d="M0,120 Q150,70 300,120 T400,120" stroke="white" strokeWidth="3" fill="none" opacity="0.3"/>
            <path d="M0,80 Q120,30 240,80 T400,80" stroke="white" strokeWidth="3" fill="none" opacity="0.4"/>
          </svg>
        </div>

        {/* Content Container - Same width as Games section */}
        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <FiArrowLeft size={20} />
              <span className="font-medium">Back</span>
            </button>
          </div>

          {/* Statistician Profile */}
          <div className="rounded-2xl shadow-sm overflow-hidden mb-4 bg-white relative">
            <div className="p-8 flex justify-between items-start">
              {/* Statistician Info */}
              <div className="flex-1">
                <span className="text-sm text-gray-500">Statistician</span>
                <h2 className="text-4xl font-bold text-blue-900 mt-2">{display.fullName}</h2>
              </div>

              {/* Statistician Image */}
              <div className="relative">
                <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
                  <img
                    src={display.image}
                    alt={display.fullName}
                    className="relative z-10 w-full h-full object-cover rounded-2xl"
                  />
                  <div className="absolute top-4 right-4 w-8 h-6 rounded-sm flex items-center justify-center z-20">
                    <img src="/flag.png" alt="flag" />
                  </div>
                </div>
              </div>
            </div>

            {/* Statistician Info Grid */}
            <div className="p-8 relative" style={{ background: "#EEF3FF" }}>
              <div className="grid grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {display.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="text-lg font-semibold text-blue-900">{display.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-lg font-semibold text-blue-900">{display.location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Games recorded</p>
                  <p className="text-lg font-semibold text-blue-900">{display.gamesRecorded}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date of birth</p>
                  <p className="text-lg font-semibold text-blue-900">{display.dob}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold text-blue-900">{display.status}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Games Officiated Section (placeholder until backend provides real data) */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Games Officiated</h2>

          {/* Games List */}
          <div className="space-y-4">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-gray-50 rounded-lg p-5 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/tournaments/1/match/${game.id}`)}
              >
                <div className="flex justify-between items-center">
                  {/* Left side - Teams and Scores */}
                  <div className="space-y-3">
                    {/* Team A */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded">
                        <img
                          src={game.teamAColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                          alt="Basketball"
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-20">{game.teamA}</span>
                      <span className="text-sm font-semibold text-gray-800">- {game.teamAScore}</span>
                    </div>

                    {/* Team B */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded">
                        <img
                          src={game.teamBColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                          alt="Basketball"
                          className="w-7 h-7 object-contain"
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 w-20">{game.teamB}</span>
                      <span className="text-sm font-semibold text-gray-800">- {game.teamBScore}</span>
                    </div>
                  </div>

                  {/* Right side - Venue and DateTime */}
                  <div className="text-right text-xs text-gray-500">
                    <p>{game.venue}</p>
                    <p>{game.datetime || `${game.time}, ${game.date}`}</p>
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

export default ViewStat;
