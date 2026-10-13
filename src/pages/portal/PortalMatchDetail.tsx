import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMatch } from '../../api/hooks';
import { ErrorState, ListSkeleton } from '../../components/admin/page-states';
import { GameView, type GameTab } from '../../components/game/GameView';
import { dataErrorMessage } from '../../lib/box-score';
import { useLivePoll } from '../../hooks/useLivePoll';

const TAB_IDS: GameTab[] = ['box', 'plays', 'shots', 'stats'];

const PortalMatchDetail: React.FC = () => {
  const { matchId } = useParams();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as GameTab | null;
  const tab: GameTab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'overview';

  const matchQuery = useMatch(matchId);
  const match = matchQuery.data;
  const sessionId = match?.gameSessions?.[0]?.id;

  // Fix 125: the header's score otherwise never updates while the game is played. GameView polls the data under it.
  useLivePoll(match?.status === 'LIVE', () => void matchQuery.refetch(), 8_000);

  const setTab = (next: GameTab) => {
    const p = new URLSearchParams(params);
    if (next === 'overview') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: true });
  };

  if (matchQuery.isPending) return <ListSkeleton columns={3} rows={3} label="Loading match" />;
  if (matchQuery.isError || !match) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/portal/matches" className="text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Matches</Link>
        <ErrorState message={dataErrorMessage(matchQuery.error, 'match')} onRetry={() => void matchQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/portal/matches" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Matches</Link>
      <GameView match={match} sessionId={sessionId} tab={tab} onTab={setTab} />
    </div>
  );
};

export default PortalMatchDetail;
