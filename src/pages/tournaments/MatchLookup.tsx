import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useMatch } from '../../api/hooks';
import { ErrorState } from '../../components/admin/page-states';
import Skeleton from '../../components/ui/Skeleton';

/**
 * `/matches/:matchId` → `/tournaments/:tournamentId/match/:matchId`.
 *
 * Some places only know a match's id — a statistician's "games officiated" list, for one, because
 * `GET /statistician/:id` returns the match but not its tournament. The match page needs the
 * tournament for its back link and for where it goes after a delete, so this looks it up rather than
 * letting a caller guess one.
 *
 * A match the signed-in account can't see answers 404 here even when another endpoint listed it
 * (Gap 45), so the error says so rather than just "not found".
 */
const MatchLookup: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const query = useMatch(matchId);

  if (query.isPending) return <Skeleton className="m-6 h-10 w-64 rounded" aria-label="Opening match" />;
  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <ErrorState
          message={`${(query.error as Error | null)?.message ?? 'Match not found'}. It may belong to a tournament your account can’t see.`}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  return <Navigate to={`/tournaments/${query.data.tournamentId}/match/${query.data.id}`} replace />;
};

export default MatchLookup;
