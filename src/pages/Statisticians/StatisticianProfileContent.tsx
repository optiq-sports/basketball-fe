import React from 'react';
import { Link } from 'react-router-dom';
import type { GameOfficiated, Statistician } from '../../types/api';
import { Badge } from '../../components/ui/primitives/badge';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { displayName, locationOf, splitFullName } from '../../components/statisticians/statistician-form';
import { normalizeName } from '../../lib/text';

const formatDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

function dateOfBirth(profile: Statistician['profile']): string {
  const { dobDay, dobMonth, dobYear } = (profile ?? {}) as { dobDay?: number | null; dobMonth?: number | null; dobYear?: number | null };
  if (!dobDay || !dobMonth || !dobYear) return '';
  const d = new Date(dobYear, dobMonth - 1, dobDay);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="truncate font-medium text-gray-900 dark:text-gray-100">{value || '—'}</dd>
    </div>
  );
}

/** The statistician's profile: who they are, and the games they have scored. */
const StatisticianProfileContent: React.FC<{ stat: Statistician }> = ({ stat }) => {
  const name = displayName(stat);
  const { firstName, lastName } = splitFullName(name);
  const games: GameOfficiated[] = stat.gamesOfficiated ?? [];
  const inactive = stat.status === 'INACTIVE';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <PlayerAvatar firstName={firstName} lastName={lastName} photo={stat.profile?.photos?.[0]} size="lg" className="size-20 text-2xl" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">Statistician</p>
            <h2 className="truncate text-2xl font-bold text-gray-900 dark:text-white">{name}</h2>
            <Badge variant={inactive ? 'warning' : 'success'} className="mt-1.5">{inactive ? 'Inactive' : 'Active'}</Badge>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Email" value={stat.email} />
          <Detail label="Phone" value={stat.profile?.phone} />
          <Detail label="Location" value={locationOf(stat)} />
          <Detail label="Home address" value={stat.profile?.homeAddress} />
          <Detail label="Date of birth" value={dateOfBirth(stat.profile)} />
          <Detail label="Games scored" value={String(games.length)} />
        </dl>

        {stat.profile?.bio && <p className="text-sm text-gray-700 dark:text-gray-300">{stat.profile.bio}</p>}
      </section>

      <section aria-labelledby="games-heading" className="flex flex-col gap-3">
        <h2 id="games-heading" className="text-lg font-bold text-gray-900 dark:text-white">Games scored</h2>

        {games.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
            No games scored yet. A game appears here once they have recorded something in it.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {games.map((g) => {
              const home = normalizeName(g.homeTeam?.name?.trim()) || 'Home';
              const away = normalizeName(g.awayTeam?.name?.trim()) || 'Away';
              const when = formatDate(g.scheduledDate);
              return (
                <li key={g.matchId}>
                  <Link
                    to={`/matches/${g.matchId}`}
                    className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-court-400/60 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <span className="font-semibold text-gray-900 dark:text-white">{home} <span className="font-normal text-gray-500">vs</span> {away}</span>
                    <span className="text-sm text-gray-500">{[when, g.venue].filter(Boolean).join(' · ') || 'No date or venue'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default StatisticianProfileContent;
