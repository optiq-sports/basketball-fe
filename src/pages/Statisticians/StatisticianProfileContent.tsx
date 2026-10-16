import React from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiMapPin } from 'react-icons/fi';
import type { GameOfficiated, Statistician } from '../../types/api';
import StatusBadge from '../../components/ui/StatusBadge';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { displayName, locationOf, splitFullName } from '../../components/statisticians/statistician-form';
import { normalizeName } from '../../lib/text';

const formatDateTime = (iso?: string | null) => {
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

/** One of the old detail tiles in the tinted band: a small label over a larger value. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="truncate text-lg font-semibold text-brand-900 dark:text-white">{value || '—'}</dd>
    </div>
  );
}

/**
 * The statistician's profile body, shared by the route page and the list's modal — back to the
 * pre-redesign shape: a white card with the name on the left and a large portrait on the right, a
 * `brand-50` band of detail tiles beneath it, then Games Officiated.
 *
 * **The games list is real.** The old component declared `const games: Game[] = []` with a comment
 * saying the backend didn't return match history, so the section was permanently empty and its row
 * markup — `/ball1.png` crests, `- {score}` and a hardcoded `/tournaments/1/match/:id` link — never
 * rendered for anyone. `GET /statistician/:id` returns `gamesOfficiated` now, so the section shows it,
 * and each game links through `/matches/:matchId`, which resolves the right tournament rather than
 * assuming tournament 1.
 *
 * The portrait is a fixed square. The old one was `w-90 h-80 mr-20 top-[2.1rem]` — `w-90` isn't a
 * Tailwind size, so the width never applied, and the offsets pushed it off its own card.
 *
 * The detail band wraps evenly instead of `grid-cols-4` with six tiles in it, which left two stranded
 * on a second row under four.
 */
const StatisticianProfileContent: React.FC<{ stat: Statistician }> = ({ stat }) => {
  const name = displayName(stat);
  const { firstName, lastName } = splitFullName(name);
  const games: GameOfficiated[] = stat.gamesOfficiated ?? [];
  const inactive = stat.status === 'INACTIVE';

  return (
    <div>
      <div className="relative mb-4 overflow-hidden rounded-2xl bg-white shadow-theme-sm dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-6 p-8">
          <div className="min-w-0 flex-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">Statistician</span>
            <h2 className="mt-2 text-4xl font-bold text-brand-900 dark:text-white">{name}</h2>
            <StatusBadge label={inactive ? 'Inactive' : 'Active'} tone={inactive ? 'neutral' : 'success'} className="mt-3" />
            {stat.profile?.bio && (
              <p className="mt-4 max-w-prose text-sm text-gray-700 dark:text-gray-300">{stat.profile.bio}</p>
            )}
          </div>

          <PlayerAvatar
            firstName={firstName}
            lastName={lastName}
            photo={stat.profile?.photos?.[0]}
            size="full"
            rounded="none"
            className="size-48 shrink-0 rounded-2xl text-5xl"
          />
        </div>

        <div className="relative bg-brand-50 p-8 dark:bg-brand-500/10">
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Detail label="Email" value={stat.email} />
            <Detail label="Phone" value={stat.profile?.phone} />
            <Detail label="Location" value={locationOf(stat)} />
            <Detail label="Home address" value={stat.profile?.homeAddress} />
            <Detail label="Date of birth" value={dateOfBirth(stat.profile)} />
            <Detail label="Games recorded" value={String(games.length)} />
          </dl>
        </div>
      </div>

      <section aria-labelledby="games-heading" className="py-4">
        <h2 id="games-heading" className="mb-4 text-xl font-bold text-gray-800 dark:text-white">Games officiated</h2>

        {games.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No games officiated yet. A game appears here once they have recorded something in it.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {games.map((g) => {
              const home = normalizeName(g.homeTeam?.name?.trim()) || 'Home';
              const away = normalizeName(g.awayTeam?.name?.trim()) || 'Away';
              const when = formatDateTime(g.scheduledDate);
              return (
                <li key={g.matchId}>
                  <Link
                    to={`/matches/${g.matchId}`}
                    aria-label={`Open ${home} against ${away}`}
                    className="block cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-theme-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {home} <span className="font-normal text-gray-500 dark:text-gray-400">vs</span> {away}
                      </span>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                        {g.venue && (
                          <p className="flex items-center justify-end gap-1.5">
                            <FiMapPin aria-hidden className="size-3.5" />
                            {g.venue}
                          </p>
                        )}
                        {when && (
                          <p className="flex items-center justify-end gap-1.5">
                            <FiCalendar aria-hidden className="size-3.5" />
                            {when}
                          </p>
                        )}
                        {!g.venue && !when && <p>No date or venue</p>}
                      </div>
                    </div>
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
