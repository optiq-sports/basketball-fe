import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Statistician } from '../../types/api';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';

interface Game {
  id: string;
  teamA: string;
  teamAColor: string;
  teamAScore: number | string;
  teamB: string;
  teamBColor: string;
  teamBScore: number | string;
  venue: string;
  datetime?: string;
  time?: string;
  date?: string;
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
      image: resolvePlayerPhotoUrl(undefined, 'unknown'),
      gamesRecorded: '—',
      dob: '—',
      status: '—',
    };
  }

  const profile = stat.profile as
    | {
        photos?: string[];
        phone?: string;
        email?: string;
        country?: string;
        state?: string;
        dobDay?: number;
        dobMonth?: number;
        dobYear?: number;
      }
    | undefined;

  const firstName = stat.firstName ?? stat.name ?? '';
  const lastName = stat.lastName ?? '';
  const nameBase =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : (stat.name as string | undefined) ??
        (profile?.email as string | undefined) ??
        (stat.email as string | undefined) ??
        '';
  const fullName = nameBase || '—';

  const loc =
    [
      (profile?.state as string | undefined) ?? (stat.state as string | undefined),
      (profile?.country as string | undefined) ?? (stat.country as string | undefined),
    ]
      .filter(Boolean)
      .join(', ') || '—';

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

  const dobDay = (profile?.dobDay as number | undefined) ?? (stat as { dobDay?: number }).dobDay;
  const dobMonth = (profile?.dobMonth as number | undefined) ?? (stat as { dobMonth?: number }).dobMonth;
  const dobYear = (profile?.dobYear as number | undefined) ?? (stat as { dobYear?: number }).dobYear;
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
    email: (profile?.email as string | undefined) ?? stat.email ?? '—',
    phone: (profile?.phone as string | undefined) ?? (stat.phone as string | undefined) ?? '—',
    location: loc,
    image: resolvePlayerPhotoUrl(primaryPhoto, stat.id),
    gamesRecorded,
    dob,
    status,
  };
}

interface StatisticianProfileContentProps {
  stat: Statistician;
}

/** Presentational statistician-profile body, shared between the standalone route page and the inline modal. */
const StatisticianProfileContent: React.FC<StatisticianProfileContentProps> = ({ stat }) => {
  const navigate = useNavigate();
  const display = buildDisplayStatistician(stat);
  // GET /statistician/:id does not yet return match history — the backend
  // needs to include gameEvents → gameSession → match in the findOne query.
  const games: Game[] = [];

  return (
    <div>
      <div className="rounded-2xl shadow-theme-sm overflow-hidden mb-4 bg-white dark:bg-gray-900 relative">
        <div className="p-8 flex justify-between items-start">
          <div className="flex-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">Statistician</span>
            <h2 className="text-4xl font-bold text-brand-900 dark:text-white mt-2">{display.fullName}</h2>
          </div>
          <div className="relative">
            <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
              <img
                src={display.image}
                onError={handlePhotoLoadError(stat.id)}
                alt={display.fullName}
                className="relative z-10 w-full h-full object-cover rounded-2xl"
              />
            </div>
          </div>
        </div>

        <div className="p-8 relative bg-brand-50 dark:bg-brand-500/10">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Games recorded</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.gamesRecorded}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Date of birth</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.dob}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{display.status}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="py-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Games Officiated</h2>

        {games.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No games officiated yet.</p>
          </div>
        )}

        <div className="space-y-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-5 border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-theme-sm transition-shadow"
              onClick={() => navigate(`/tournaments/1/match/${game.id}`)}
            >
              <div className="flex justify-between items-center">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded">
                      <img
                        src={game.teamAColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                        alt="Basketball"
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">{game.teamA}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">- {game.teamAScore}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded">
                      <img
                        src={game.teamBColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                        alt="Basketball"
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">{game.teamB}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">- {game.teamBScore}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <p>{game.venue}</p>
                  <p>{game.datetime || `${game.time}, ${game.date}`}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatisticianProfileContent;
