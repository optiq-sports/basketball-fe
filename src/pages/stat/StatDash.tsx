import React, { useState, useEffect, useRef, useCallback } from 'react';
import MenuBar from './components/MenuBar';
import Scoreboard from './components/Scoreboard';
import CourtSection from './components/CourtSection';
import SubstitutionModal, { SubEvent } from './components/SubstitutionModal';
import TimeoutModal from './components/TimeoutModal';
import GameLog from './components/GameLog';

// ─── Shared type (also consumed by GameLog) ────────────────────────────────────
export interface GameEvent {
  id: string;
  period: string;
  clock: string;
  team: string;
  player: string;
  action: string;
  result: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TEAM_1_COLOR = '#E63946';
const TEAM_2_COLOR = '#D4A017';
const PERIOD_SECONDS = 600; // 10-minute quarters

const MOCK_EVENTS: GameEvent[] = [
  { id: '1', period: 'Q1', clock: '09:22', team: 'Team 1', player: '#5 M. Abdul',   action: 'shot',     result: '3pt made'   },
  { id: '2', period: '',   clock: '',      team: 'Team 2', player: '#10 s. Langas',  action: 'rebound',  result: 'DF rebound' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ─── Parent page ───────────────────────────────────────────────────────────────
const StatDash: React.FC = () => {
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [quarter, setQuarter] = useState(1);
  const [timeLeft, setTimeLeft]   = useState(PERIOD_SECONDS);
  const [isRunning, setIsRunning] = useState(false);

  // Refs used by the tick loop — avoids stale closures
  const startEpochRef = useRef<number>(0);   // Date.now() when clock last started
  const startValueRef = useRef<number>(PERIOD_SECONDS); // timeLeft value at that moment
  const [events, setEvents] = useState<GameEvent[]>(MOCK_EVENTS);
  const [selectedTeam1Player, setSelectedTeam1Player] = useState<number | null>(null);
  const [selectedTeam2Player, setSelectedTeam2Player] = useState<number | null>(null);
  const [possession, setPossession] = useState<1 | 2>(1);

  // ── Accurate countdown using Date.now() as reference ─────────────────────────
  // Polls every 100 ms so the display updates within 1/10 s of a real second tick.
  useEffect(() => {
    if (!isRunning) return;

    // Capture the real-world start point each time the clock is (re)started
    startEpochRef.current = Date.now();
    startValueRef.current = timeLeft;          // snapshot of current value

    const id = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - startEpochRef.current) / 1000);
      const remaining = Math.max(0, startValueRef.current - elapsed);

      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsRunning(false);
      }
    }, 100); // 100 ms poll — tight enough to never skip a visible second

    return () => clearInterval(id);
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event log helper ─────────────────────────────────────────────────────────
  const addEvent = useCallback(
    (team: string, player: string, action: string, result: string) => {
      setEvents((prev) => [
        {
          id: Date.now().toString(),
          period: `Q${quarter}`,
          clock: formatTime(timeLeft),
          team,
          player,
          action,
          result,
        },
        ...prev,
      ]);
    },
    [quarter, timeLeft]
  );

  // ── Player actions ───────────────────────────────────────────────────────────
  const handleFoul = (teamNum: 1 | 2) => {
    const teamName = teamNum === 1 ? 'Team 1' : 'Team 2';
    const playerNum = teamNum === 1 ? selectedTeam1Player : selectedTeam2Player;
    addEvent(teamName, playerNum ? `#${playerNum}` : teamName, 'foul', 'personal foul');
    // Score updates come from CourtSection via onAddScore (made shots + made FTs only)
  };

  const handleTurnover = (teamNum: 1 | 2) => {
    const teamName = teamNum === 1 ? 'Team 1' : 'Team 2';
    const playerNum = teamNum === 1 ? selectedTeam1Player : selectedTeam2Player;
    addEvent(teamName, playerNum ? `#${playerNum}` : teamName, 'turnover', 'live ball');
  };

  const [showTimeout, setShowTimeout] = useState(false);

  const handleTimeout = () => {
    setIsRunning(false);
    setShowTimeout(true);
  };

  const handleTimeoutSelect = (who: 'team1' | 'team2' | 'officials') => {
    const label =
      who === 'team1' ? 'TEAM 1' : who === 'team2' ? 'TEAM 2' : 'Officials';
    addEvent(label, '', 'timeout', 'full timeout');
    setShowTimeout(false);
  };

  const handleJumpBall = () => {
    addEvent('', '', 'jump ball', '');
  };

  const [showSub, setShowSub] = useState(false);

  const handleSub = () => setShowSub(true);

  const handleSubFinish = (subs: SubEvent[]) => {
    subs.forEach(({ team, playerOut, playerIn }) => {
      addEvent(
        `Team ${team}`,
        `#${playerIn}`,
        'substitution',
        `#${playerOut} ← #${playerIn}`,
      );
    });
    setShowSub(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F0F2F5]">
      {/* ── Top menu bar ─────────────────────────────────────────────────────── */}
      <MenuBar />

      {/* ── Centered content: scoreboard, court, game log ────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full items-center">
        <div className="w-full max-w-6xl flex-1 min-h-0 flex flex-col overflow-hidden mx-auto">
          <Scoreboard
            team1Name="TEAM 1"
            team1Score={team1Score}
            team1Color={TEAM_1_COLOR}
            team2Name="TEAM 2"
            team2Score={team2Score}
            team2Color={TEAM_2_COLOR}
            quarter={quarter}
            timeLeft={timeLeft}
            isRunning={isRunning}
            onToggleClock={() => setIsRunning((r) => !r)}
            onAdjustTime={(delta) =>
              setTimeLeft((t) => {
                const next = Math.max(0, Math.min(PERIOD_SECONDS, t + delta));
                if (isRunning) {
                  startEpochRef.current = Date.now();
                  startValueRef.current = next;
                }
                return next;
              })
            }
            onTimeout={handleTimeout}
            onJumpBall={handleJumpBall}
            onSub={handleSub}
          />

          <div className="flex-1 min-h-0 min-w-0">
            <CourtSection
            team1Color={TEAM_1_COLOR}
            team2Color={TEAM_2_COLOR}
            team1Name="TEAM 1"
            team2Name="TEAM 2"
            possession={possession}
            onTogglePossession={() => setPossession((p) => (p === 1 ? 2 : 1))}
            selectedTeam1Player={selectedTeam1Player}
            selectedTeam2Player={selectedTeam2Player}
            onSelectTeam1Player={(n) => setSelectedTeam1Player((p) => (p === n ? null : n))}
            onSelectTeam2Player={(n) => setSelectedTeam2Player((p) => (p === n ? null : n))}
            onFoul1={() => handleFoul(1)}
            onTurnover1={() => handleTurnover(1)}
            onFoul2={() => handleFoul(2)}
            onTurnover2={() => handleTurnover(2)}
            onAddEvent={addEvent}
            onAddScore={(team, points) => {
              if (team === 1) setTeam1Score((s) => s + points);
              else setTeam2Score((s) => s + points);
            }}
          />
        </div>
        <GameLog events={events} />
      </div>

      {/* ── Timeout overlay ──────────────────────────────────────────────────── */}
      {showTimeout && (
        <TimeoutModal
          team1Color={TEAM_1_COLOR}
          team2Color={TEAM_2_COLOR}
          team1Name="TEAM 1"
          team2Name="TEAM 2"
          onSelect={handleTimeoutSelect}
          onCancel={() => setShowTimeout(false)}
        />
      )}

      {/* ── Substitution overlay ─────────────────────────────────────────────── */}
      {showSub && (
        <SubstitutionModal
          team1Color={TEAM_1_COLOR}
          team2Color={TEAM_2_COLOR}
          team1Name="TEAM 1"
          team2Name="TEAM 2"
          onFinish={handleSubFinish}
          onCancel={() => setShowSub(false)}
        />
      )}
    </div>
  );
};

export default StatDash;
