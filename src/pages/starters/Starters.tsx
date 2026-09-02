import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight, FiLogOut } from 'react-icons/fi';
import { queryKeys, useMatch } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import StartersFlow, { type StartersFlowHandle } from './StartersFlow';
import { readStoredSessionContext, writeStoredLineups } from '../../features/statdash/sessionContextStorage';
import { performLogout } from '../../auth/authSession';
import { GATEWAY_DISPLAY_FONT_STACK, GATEWAY_FONT_STACK } from '../../authGatewayTheme';

const Starters: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startersFlowRef = useRef<StartersFlowHandle>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const sessionCtx = useMemo(() => readStoredSessionContext(), []);
  const matchQuery = useMatch(sessionCtx?.matchId);

  const homePlayers = useMemo(() => {
    const roster = matchQuery.data?.homeTeam?.playerTeams ?? [];
    return roster
      .filter((pt) => pt.player)
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchQuery.data]);

  const awayPlayers = useMemo(() => {
    const roster = matchQuery.data?.awayTeam?.playerTeams ?? [];
    return roster
      .filter((pt) => pt.player)
      .map((pt) => ({
        jersey: pt.jerseyNumber ?? 0,
        name: `${pt.player!.firstName} ${pt.player!.lastName}`,
      }));
  }, [matchQuery.data]);

  useEffect(() => {
    if (!readStoredSessionContext()) {
      navigate('/match-key', { replace: true });
    }
  }, [navigate]);

  const handleContinue = useCallback(async () => {
    if (!startersFlowRef.current?.attemptContinue()) {
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    const lineups = startersFlowRef.current.getLineups();
    if (lineups) {
      writeStoredLineups(lineups);
      console.log('[Starters] Lineup saved to sessionStorage:', {
        home: { onCourt: lineups.home.onCourt, bench: lineups.home.bench },
        away: { onCourt: lineups.away.onCourt, bench: lineups.away.bench },
      });
    } else {
      console.warn('[Starters] getLineups() returned null — gate not ready');
    }
    setIsSubmitting(true);
    navigate('/choose-sides');
    setIsSubmitting(false);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    performLogout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  }, [navigate, queryClient]);

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
            opacity: 0.32,
            filter: 'blur(24px)',
            transform: 'scale(1.08)',
          }}
        />
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/60 bg-white/70 px-6 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md sm:px-8">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <FiLogOut size={15} />
            Log out
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleContinue}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {isSubmitting ? 'Saving…' : 'Continue'}
            <FiArrowRight size={16} />
          </button>
        </header>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6 sm:px-8">
          <div className="mx-auto mb-5 w-full max-w-6xl sm:mb-6">
            <h1
              className="text-[2.1rem] leading-none text-gray-900 sm:text-[2.4rem]"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK }}
            >
              Set the starting lineups
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Mark who&rsquo;s playing, then lock in exactly five starters per team.
            </p>
          </div>
          <StartersFlow
            ref={startersFlowRef}
            variant="page"
            homeName={matchQuery.data?.homeTeam?.name}
            awayName={matchQuery.data?.awayTeam?.name}
            homePlayers={homePlayers.length > 0 ? homePlayers : undefined}
            awayPlayers={awayPlayers.length > 0 ? awayPlayers : undefined}
          />
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default Starters;
