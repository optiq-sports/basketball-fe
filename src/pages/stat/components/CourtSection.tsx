import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiArrowLeft } from 'react-icons/fi';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CourtMarker {
  id: string;
  x: number;
  y: number;
  type: 'shot' | 'foul' | 'missed';
  color: string;
  label: string;
  playerNum?: number;
  playerTeam?: 1 | 2;
}

type PlayerInfo = { num: number; name: string; team: 1 | 2; color: string };

export interface CourtSectionProps {
  team1Color: string;
  team2Color: string;
  team1Name?: string;
  team2Name?: string;
  possession: 1 | 2;
  onTogglePossession: () => void;
  selectedTeam1Player: number | null;
  selectedTeam2Player: number | null;
  onSelectTeam1Player: (n: number) => void;
  onSelectTeam2Player: (n: number) => void;
  onFoul1: () => void;
  onTurnover1: () => void;
  onFoul2: () => void;
  onTurnover2: () => void;
  onAddEvent?: (team: string, player: string, action: string, result: string) => void;
}

// ─── Mock players for each team ───────────────────────────────────────────────
const TEAM1_PLAYERS = [
  { num: 1, name: 'Ibrahim Maina'  },
  { num: 2, name: 'Mohamed Abdul'  },
  { num: 3, name: 'Samuel Langas'  },
  { num: 4, name: 'Khalid Hassan'  },
  { num: 5, name: 'Amine Diallo'   },
];
const TEAM2_PLAYERS = [
  { num: 6,  name: 'David Okafor'  },
  { num: 7,  name: 'Thomas Mensah' },
  { num: 8,  name: 'James Nwosu'   },
  { num: 9,  name: 'Bilal Yusuf'   },
  { num: 10, name: 'Chidi Eze'     },
];

// ─── Missed shot options (no points, no assist) ───────────────────────────────
const MISSED_SHOT_OPTIONS = [
  { name: 'Jump Shot' },
  { name: 'Layup'     },
  { name: 'Dunk'      },
  { name: 'Post Shot' },
];

// ─── Made shot type options ───────────────────────────────────────────────────
const SHOT_OPTIONS = [
  { name: 'Jump Shot', color: '#3b82f6', points: 2 },
  { name: 'Layup',     color: '#10b981', points: 2 },
  { name: 'Dunk',      color: '#ef4444', points: 2 },
  { name: 'Fast Shot', color: '#f59e0b', points: 2 },
  { name: '3-Pointer', color: '#8b5cf6', points: 3 },
  { name: 'Free Throw',color: '#0891b2', points: 1 },
];


// ─── Made-shot wizard state (3 steps) ────────────────────────────────────────
type WizardStep = 0 | 1 | 2; // 0=player, 1=shot type, 2=assist

interface WizardData {
  courtX: number;
  courtY: number;
  step: WizardStep;
  player: PlayerInfo | null;
  shotOption: typeof SHOT_OPTIONS[number] | null;
  fastBreak: boolean;
}

// ─── Turnover types ───────────────────────────────────────────────────────────
const TURNOVER_TYPES = [
  'Ball Handling', 'Bad Pass',   'Double Dribble',
  'Travel',        'Out of Bounce', 'Back Court',
  '3 Seconds',     '8 Seconds',  '24 Seconds',
];

// ─── Turnover wizard state (3 steps) ─────────────────────────────────────────
// 0 = player who turned it over
// 1 = turnover type
// 2 = steal player (or No Steal)
type TurnoverStep = 0 | 1 | 2;

interface TurnoverWizardData {
  turnoverTeam: 1 | 2;
  step:         TurnoverStep;
  player:       FoulLabel | null;   // reuse simple label type
  turnoverType: string | null;
  steal:        FoulLabel | null | 'none';
}

const mkTurnoverInit = (team: 1 | 2): TurnoverWizardData => ({
  turnoverTeam: team, step: 0,
  player: null, turnoverType: null, steal: null,
});

// ─── Foul types ───────────────────────────────────────────────────────────────
const FOUL_TYPES_WIZARD = [
  'Personal', 'Shooting', 'Technical',
  'Unsportsmanlike', 'Double Foul', 'Offensive',
];

// ─── Rebound outcomes ────────────────────────────────────────────────────────
const REBOUND_OPTIONS = [
  'Tip-In Layup Made',
  'Tip-In Layup Miss',
  'Tip-In Dunk Made',
  'Tip-In Dunk Miss',
  'Out of Bounce',
  '24 Secs Violation',
  'Blocked',
];

// ─── Missed-shot wizard state (steps 0-4) ────────────────────────────────────
// 0 = select player who missed
// 1 = select shot type
// 2 = rebound / outcome
// 3 = select block player   (only when outcome === 'Blocked')
// 4 = select missed player  (only when outcome === 'Blocked')
type MissedStep = 0 | 1 | 2 | 3 | 4;

interface MissedWizardData {
  courtX: number;
  courtY: number;
  step: MissedStep;
  player: PlayerInfo | null;
  shotOption: string | null;
  fastBreak: boolean;
  reboundOutcome: string | null;
  blockPlayer: PlayerInfo | null;
  reboundPlayer: PlayerInfo | null;
}

const MISSED_INIT: MissedWizardData = {
  courtX: 0, courtY: 0,
  step: 0, player: null, shotOption: null, fastBreak: false,
  reboundOutcome: null, blockPlayer: null, reboundPlayer: null,
};

// ─── Foul wizard state ────────────────────────────────────────────────────────
type FoulStep = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = select fouler (player / BENCH / COACH)
// 1 = select foul type
// 2 = select receiver (player who was fouled)
// 3 = select number of free throws awarded
// 4 = select assist player
// 5 = enter free throw results

interface FoulLabel { label: string; team: 1 | 2; num?: number }

interface FoulWizardData {
  foulTeam: 1 | 2;
  step: FoulStep;
  fouler:          FoulLabel | null;
  foulType:        string | null;
  receiver:        FoulLabel | null;
  freeThrowCount:  0 | 1 | 2 | 3;
  assist:          FoulLabel | null | 'none';
  ftResults:       (boolean | null)[];   // true = made, false = missed
}

const mkFoulInit = (team: 1 | 2): FoulWizardData => ({
  foulTeam: team, step: 0,
  fouler: null, foulType: null, receiver: null,
  freeThrowCount: 0, assist: null, ftResults: [],
});

// ─── SVG coordinate helper ────────────────────────────────────────────────────
function toSvgPoint(svgEl: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
}

// ─── Gray court SVG ────────────────────────────────────────────────────────────
interface GrayCourtProps {
  onCourtLeftClick?: (x: number, y: number, sx: number, sy: number) => void;
  onCourtRightClick?: (x: number, y: number) => void;
  markers?: CourtMarker[];
}

const GrayCourt: React.FC<GrayCourtProps> = ({ onCourtLeftClick, onCourtRightClick, markers = [] }) => {
  const frame = '#BABABA', surface = '#DEDEDE', line = '#8A8A8A', sw = 2;

  const coords = (e: React.MouseEvent<SVGRectElement>) => {
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
    return toSvgPoint(svgEl, e.clientX, e.clientY);
  };

  return (
    <svg viewBox="0 0 600 360" width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg">
      {/* Frame */}
      <rect x={0} y={0} width={600} height={360} fill={frame} />
      <rect x={12} y={12} width={576} height={336} fill={surface} stroke={line} strokeWidth={sw} />
      {/* Centre */}
      <line x1={300} y1={12} x2={300} y2={348} stroke={line} strokeWidth={sw} />
      <circle cx={300} cy={180} r={46} fill="none" stroke={line} strokeWidth={sw} />
      {/* Left side */}
      <rect x={12} y={124} width={132} height={112} fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 144 124 A 56 56 0 0 1 144 236" fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 144 124 A 56 56 0 0 0 144 236" fill="none" stroke={line} strokeWidth={sw} strokeDasharray="5 4" />
      <line x1={20} y1={160} x2={20} y2={200} stroke={line} strokeWidth={3.5} />
      <circle cx={46} cy={180} r={9} fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 46 161 A 19 19 0 0 1 46 199" fill="none" stroke={line} strokeWidth={sw} />
      {[0.28, 0.50, 0.72, 0.91].map((f) => (
        <React.Fragment key={f}>
          <line x1={12 + 132 * f} y1={124} x2={12 + 132 * f} y2={116} stroke={line} strokeWidth={sw} />
          <line x1={12 + 132 * f} y1={236} x2={12 + 132 * f} y2={244} stroke={line} strokeWidth={sw} />
        </React.Fragment>
      ))}
      {/* Right side (mirror) */}
      <rect x={456} y={124} width={132} height={112} fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 456 124 A 56 56 0 0 0 456 236" fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 456 124 A 56 56 0 0 1 456 236" fill="none" stroke={line} strokeWidth={sw} strokeDasharray="5 4" />
      <line x1={580} y1={160} x2={580} y2={200} stroke={line} strokeWidth={3.5} />
      <circle cx={554} cy={180} r={9} fill="none" stroke={line} strokeWidth={sw} />
      <path d="M 554 161 A 19 19 0 0 0 554 199" fill="none" stroke={line} strokeWidth={sw} />
      {[0.28, 0.50, 0.72, 0.91].map((f) => (
        <React.Fragment key={f}>
          <line x1={588 - 132 * f} y1={124} x2={588 - 132 * f} y2={116} stroke={line} strokeWidth={sw} />
          <line x1={588 - 132 * f} y1={236} x2={588 - 132 * f} y2={244} stroke={line} strokeWidth={sw} />
        </React.Fragment>
      ))}
      {/* Click overlay */}
      <rect x={0} y={0} width={600} height={360} fill="transparent"
        style={{ cursor: 'crosshair' }}
        onClick={(e) => {
          const sp = coords(e);
          onCourtLeftClick?.(sp.x, sp.y, e.clientX, e.clientY);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const sp = coords(e);
          onCourtRightClick?.(sp.x, sp.y);
        }}
      />
      {/* Shot markers */}
      {markers.filter((m) => m.type === 'shot').map((m) => (
        <g key={m.id} style={{ pointerEvents: 'none' }}>
          <circle cx={m.x} cy={m.y} r={8} fill={m.color} stroke="white" strokeWidth={2} />
        </g>
      ))}
      {/* Foul markers (×) */}
      {markers.filter((m) => m.type === 'foul').map((m) => (
        <g key={m.id} style={{ pointerEvents: 'none' }}>
          <line x1={m.x - 8} y1={m.y - 8} x2={m.x + 8} y2={m.y + 8} stroke={m.color} strokeWidth={3} strokeLinecap="round" />
          <line x1={m.x + 8} y1={m.y - 8} x2={m.x - 8} y2={m.y + 8} stroke={m.color} strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}
      {/* Missed-shot markers (hollow circle with diagonal slash) */}
      {markers.filter((m) => m.type === 'missed').map((m) => (
        <g key={m.id} style={{ pointerEvents: 'none' }}>
          <circle cx={m.x} cy={m.y} r={8} fill="white" stroke="#6b7280" strokeWidth={2} />
          <line x1={m.x - 5} y1={m.y + 5} x2={m.x + 5} y2={m.y - 5} stroke="#6b7280" strokeWidth={2} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
};

// ─── Shared helpers ────────────────────────────────────────────────────────────
// Returns offense players first, then defense players
function groupedPlayers(
  possession: 1 | 2,
  team1Color: string,
  team2Color: string,
  t1Name: string,
  t2Name: string,
  exclude?: PlayerInfo | null,
) {
  const t1 = TEAM1_PLAYERS.map((p) => ({ ...p, team: 1 as const, color: team1Color, teamName: t1Name }));
  const t2 = TEAM2_PLAYERS.map((p) => ({ ...p, team: 2 as const, color: team2Color, teamName: t2Name }));
  const offense = (possession === 1 ? t1 : t2).filter(
    (p) => !(exclude && p.num === exclude.num && p.team === exclude.team),
  );
  const defense = (possession === 1 ? t2 : t1).filter(
    (p) => !(exclude && p.num === exclude.num && p.team === exclude.team),
  );
  return { offense, defense, offenseName: possession === 1 ? t1Name : t2Name, defenseName: possession === 1 ? t2Name : t1Name };
}

function PlayerRow({ p, onClick }: { p: PlayerInfo & { teamName?: string }; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded transition-colors text-left"
    >
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: p.color }}>
        {p.num}
      </span>
      <span className="text-sm text-gray-800">{p.name}</span>
    </button>
  );
}

const FastBreakToggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
  <div className="flex items-center justify-between px-1 mt-2">
    <span className="text-sm text-gray-700 font-medium">Fast break</span>
    <button title="Toggle fast break" onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

const WizardNav = ({ onBack, onCancel, showBack = true }: { onBack?: () => void; onCancel: () => void; showBack?: boolean }) => (
  <div className="border-t border-gray-100 px-4 py-2 flex justify-between">
    {showBack && onBack
      ? <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"><FiArrowLeft size={13} /> Back</button>
      : <span />}
    <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"><FiX size={13} /> Cancel</button>
  </div>
);

// ─── 3-step made-shot wizard ──────────────────────────────────────────────────
interface ShotWizardProps {
  wizard: WizardData;
  team1Color: string;
  team2Color: string;
  team1Name: string;
  team2Name: string;
  possession: 1 | 2;
  onSelectPlayer: (p: WizardData['player']) => void;
  onSelectShot: (s: typeof SHOT_OPTIONS[number]) => void;
  onToggleFastBreak: () => void;
  onSelectAssist: (p: WizardData['player'] | null) => void;
  onBack: () => void;
  onCancel: () => void;
}

const ShotWizard: React.FC<ShotWizardProps> = ({
  wizard, team1Color, team2Color, team1Name, team2Name, possession,
  onSelectPlayer, onSelectShot, onToggleFastBreak, onSelectAssist,
  onBack, onCancel,
}) => {
  const { step, player, shotOption, fastBreak } = wizard;
  const { offense, defense, offenseName, defenseName } = groupedPlayers(possession, team1Color, team2Color, team1Name, team2Name);
  const assistGroups = groupedPlayers(possession, team1Color, team2Color, team1Name, team2Name, player);

  const PANEL_LABELS = ['MADE SHOT PLAYER', 'SHOT TYPE', 'ASSIST'];

  const PlayerGroupList = ({ players, heading, onSelect }: { players: (PlayerInfo & { teamName?: string })[]; heading: string; onSelect: (p: PlayerInfo) => void }) => (
    <>
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{heading}</p>
      {players.map((p) => <PlayerRow key={`${p.team}-${p.num}`} p={p} onClick={() => onSelect(p)} />)}
    </>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-5xl px-6">
        <div className="grid grid-cols-3 gap-4 mb-2">
          {PANEL_LABELS.map((label, i) => (
            <p key={label} className={`text-xs font-bold tracking-widest uppercase px-1 ${i === step ? 'text-white' : 'text-gray-500 opacity-50'}`}>{label}</p>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">

          {/* Panel 1 — MADE SHOT PLAYER */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 0 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">
                {step === 0 ? 'SELECT PLAYER FOR MADE SHOT' : player ? `#${player.num} ${player.name}` : '—'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <PlayerGroupList players={offense} heading={`⬤ ${offenseName} (offense)`} onSelect={onSelectPlayer} />
              <PlayerGroupList players={defense} heading={defenseName} onSelect={onSelectPlayer} />
            </div>
            <WizardNav onCancel={onCancel} showBack={false} />
          </div>

          {/* Panel 2 — SHOT TYPE */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 1 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">
                {step <= 1 ? 'SHOT TYPE' : shotOption?.name ?? '—'}
              </p>
            </div>
            <div className="flex-1 px-4 py-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {SHOT_OPTIONS.map((s) => (
                  <button key={s.name} onClick={() => onSelectShot(s)}
                    className="py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm">
                    {s.name}
                  </button>
                ))}
              </div>
              <FastBreakToggle value={fastBreak} onToggle={onToggleFastBreak} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

          {/* Panel 3 — ASSIST */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 2 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SELECT PLAYER FOR ASSIST</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <button onClick={() => onSelectAssist(null)}
                className="w-full text-center py-2 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors font-medium border border-dashed border-gray-300 mt-1 mb-1">
                No Assist
              </button>
              <PlayerGroupList players={assistGroups.offense} heading={`${offenseName} (same team)`} onSelect={onSelectAssist} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Missed-shot wizard (up to 5 steps) ──────────────────────────────────────
interface MissedWizardProps {
  wizard: MissedWizardData;
  team1Color: string;
  team2Color: string;
  team1Name: string;
  team2Name: string;
  possession: 1 | 2;
  onSelectPlayer: (p: PlayerInfo) => void;
  onSelectShot: (name: string) => void;
  onToggleFastBreak: () => void;
  onSelectRebound: (outcome: string) => void;
  onSelectBlockPlayer: (p: PlayerInfo) => void;
  onSelectMissedPlayer: (p: PlayerInfo) => void;
  onBack: () => void;
  onCancel: () => void;
}

const MissedShotWizard: React.FC<MissedWizardProps> = ({
  wizard, team1Color, team2Color, team1Name, team2Name, possession,
  onSelectPlayer, onSelectShot, onToggleFastBreak,
  onSelectRebound, onSelectBlockPlayer, onSelectMissedPlayer,
  onBack, onCancel,
}) => {
  const { step, player, fastBreak } = wizard;
  const { offense, defense, offenseName, defenseName } = groupedPlayers(possession, team1Color, team2Color, team1Name, team2Name);
  const defenseGrouped = groupedPlayers(possession === 1 ? 2 : 1, team1Color, team2Color, team1Name, team2Name);

  const PlayerGroupList = ({ players, heading, onSelect }: { players: (PlayerInfo & { teamName?: string })[]; heading: string; onSelect: (p: PlayerInfo) => void }) => (
    <>
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{heading}</p>
      {players.map((p) => <PlayerRow key={`${p.team}-${p.num}`} p={p} onClick={() => onSelect(p)} />)}
    </>
  );

  // ── Steps 0–1: player + shot type (2 panels) ────────────────────────────
  if (step <= 1) {
    return (
      <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
        <div className="w-full max-w-3xl px-6">
          <div className="grid grid-cols-2 gap-4 mb-2">
            {['MISSED SHOT PLAYER', 'SHOT TYPE / MISSED SHOT'].map((label, i) => (
              <p key={label} className={`text-xs font-bold tracking-widest uppercase px-1 ${i === step ? 'text-white' : 'text-gray-500 opacity-50'}`}>{label}</p>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">

            {/* Panel 1 — player */}
            <div className={`bg-white rounded-lg flex flex-col ${step === 0 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">
                  {step === 0 ? 'SELECT PLAYER FOR MISSED SHOT' : player ? `#${player.num} ${player.name}` : '—'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-2">
                <PlayerGroupList players={offense} heading={`⬤ ${offenseName} (offense)`} onSelect={onSelectPlayer} />
                <PlayerGroupList players={defense} heading={defenseName} onSelect={onSelectPlayer} />
              </div>
              <WizardNav onCancel={onCancel} showBack={false} />
            </div>

            {/* Panel 2 — shot type */}
            <div className={`bg-white rounded-lg flex flex-col ${step === 1 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SHOT TYPE</p>
              </div>
              <div className="flex-1 px-4 py-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {MISSED_SHOT_OPTIONS.map((s) => (
                    <button key={s.name} onClick={() => onSelectShot(s.name)}
                      className="py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-gray-500 hover:bg-gray-50 transition-colors shadow-sm">
                      {s.name}
                    </button>
                  ))}
                </div>
                <FastBreakToggle value={fastBreak} onToggle={onToggleFastBreak} />
              </div>
              <WizardNav onBack={onBack} onCancel={onCancel} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Rebound / outcome (single wide panel) ────────────────────────
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
        <div className="w-full max-w-xl px-6">
          <p className="text-xs font-bold tracking-widest uppercase text-white mb-2">REBOUND / MISSED SHOT</p>
          <div className="bg-white rounded-lg flex flex-col" style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SELECT PLAYER FOR REBOUND</p>
            </div>
            <div className="flex-1 px-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                {REBOUND_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => onSelectRebound(opt)}
                    className={`py-2.5 text-sm font-medium rounded border transition-colors shadow-sm ${
                      opt === 'Blocked'
                        ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>
        </div>
      </div>
    );
  }

  // ── Steps 3–4: Blocked flow (2 panels) ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl px-6">
        <div className="grid grid-cols-2 gap-4 mb-2">
          {['SHOT BLOCK PLAYER', 'MISSED SHOT PLAYER'].map((label, i) => (
            <p key={label} className={`text-xs font-bold tracking-widest uppercase px-1 ${(step === 3 && i === 0) || (step === 4 && i === 1) ? 'text-white' : 'text-gray-500 opacity-50'}`}>{label}</p>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">

          {/* Panel — block player (defense team first) */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 3 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">
                {step === 3 ? 'SELECT PLAYER FOR BLOCK' : wizard.blockPlayer ? `#${wizard.blockPlayer.num} ${wizard.blockPlayer.name}` : '—'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <PlayerGroupList players={defenseGrouped.offense} heading={`⬤ ${defenseGrouped.offenseName} (defense)`} onSelect={onSelectBlockPlayer} />
              <PlayerGroupList players={defenseGrouped.defense} heading={defenseGrouped.defenseName} onSelect={onSelectBlockPlayer} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

          {/* Panel — missed player */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 4 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SELECT PLAYER FOR MISSED SHOT</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <PlayerGroupList players={offense} heading={`⬤ ${offenseName} (offense)`} onSelect={onSelectMissedPlayer} />
              <PlayerGroupList players={defense} heading={defenseName} onSelect={onSelectMissedPlayer} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Turnover wizard ──────────────────────────────────────────────────────────
interface TurnoverWizardProps {
  wizard:             TurnoverWizardData;
  team1Color:         string;
  team2Color:         string;
  team1Name:          string;
  team2Name:          string;
  onSelectPlayer:     (f: FoulLabel) => void;
  onSelectType:       (t: string) => void;
  onSelectSteal:      (s: FoulLabel | 'none') => void;
  onBack:             () => void;
  onCancel:           () => void;
}

const TurnoverWizard: React.FC<TurnoverWizardProps> = ({
  wizard, team1Color, team2Color, team1Name, team2Name,
  onSelectPlayer, onSelectType, onSelectSteal,
  onBack, onCancel,
}) => {
  const { step, player } = wizard;

  const t1 = TEAM1_PLAYERS.map((p) => ({ ...p, team: 1 as const, color: team1Color }));
  const t2 = TEAM2_PLAYERS.map((p) => ({ ...p, team: 2 as const, color: team2Color }));
  const turnoverTeamPlayers = wizard.turnoverTeam === 1 ? t1 : t2;
  const otherTeamPlayers    = wizard.turnoverTeam === 1 ? t2 : t1;
  const turnoverTeamName    = wizard.turnoverTeam === 1 ? team1Name : team2Name;
  const otherTeamName       = wizard.turnoverTeam === 1 ? team2Name : team1Name;

  const PLabel = ({ label, active }: { label: string; active: boolean }) => (
    <p className={`text-xs font-bold tracking-widest uppercase px-1 ${active ? 'text-white' : 'text-gray-500 opacity-50'}`}>{label}</p>
  );

  const PlayerList = ({ players, onSelect }: { players: (PlayerInfo & { team: 1 | 2 })[]; onSelect: (f: FoulLabel) => void }) => (
    <>
      {players.map((p) => (
        <button key={`${p.team}-${p.num}`}
          onClick={() => onSelect({ label: `#${p.num} ${p.name}`, team: p.team })}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded transition-colors text-left"
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: p.color }}>{p.num}</span>
          <span className="text-sm text-gray-800">{p.name}</span>
        </button>
      ))}
    </>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-5xl px-6">
        <div className="grid grid-cols-3 gap-4 mb-2">
          <PLabel label="PLAYER FOR TURNOVER" active={step === 0} />
          <PLabel label="TURNOVER TYPE"        active={step === 1} />
          <PLabel label="STEAL"                active={step === 2} />
        </div>
        <div className="grid grid-cols-3 gap-4">

          {/* Panel 0 — Turnover player */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 0 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">
                {step === 0 ? 'SELECT PLAYER FOR TURNOVER' : player?.label ?? '—'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{turnoverTeamName}</p>
              <PlayerList players={turnoverTeamPlayers} onSelect={onSelectPlayer} />
            </div>
            <WizardNav onCancel={onCancel} showBack={false} />
          </div>

          {/* Panel 1 — Turnover type */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 1 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SELECT TURNOVER TYPE</p>
            </div>
            <div className="flex-1 px-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                {TURNOVER_TYPES.map((t) => (
                  <button key={t} onClick={() => onSelectType(t)}
                    className="py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm">
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

          {/* Panel 2 — Steal */}
          <div className={`bg-white rounded-lg flex flex-col ${step === 2 ? '' : 'opacity-50 pointer-events-none'}`} style={{ minHeight: 300 }}>
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">SELECT PLAYER FOR STEAL</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <button onClick={() => onSelectSteal('none')}
                className="w-full text-center py-2 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors font-medium border border-dashed border-gray-300 mt-1 mb-2">
                No Steal
              </button>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{otherTeamName}</p>
              <PlayerList players={otherTeamPlayers} onSelect={onSelectSteal} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Foul wizard ──────────────────────────────────────────────────────────────
interface FoulWizardProps {
  wizard: FoulWizardData;
  team1Color: string;
  team2Color: string;
  team1Name: string;
  team2Name: string;
  onSelectFouler:      (f: FoulLabel) => void;
  onSelectFoulType:    (t: string)    => void;
  onSelectReceiver:    (f: FoulLabel) => void;
  onSelectFTCount:     (n: 0|1|2|3)  => void;
  onSelectAssist:      (a: FoulLabel | 'none') => void;
  onSetFTResult:       (idx: number, made: boolean) => void;
  onComplete:          () => void;
  onBack:              () => void;
  onCancel:            () => void;
}

const FoulWizard: React.FC<FoulWizardProps> = ({
  wizard, team1Color, team2Color, team1Name, team2Name,
  onSelectFouler, onSelectFoulType, onSelectReceiver,
  onSelectFTCount, onSelectAssist, onSetFTResult,
  onComplete, onBack, onCancel,
}) => {
  const { step, fouler, foulType, receiver, freeThrowCount, assist, ftResults } = wizard;

  // Build player lists with colour
  const t1 = TEAM1_PLAYERS.map((p) => ({ ...p, team: 1 as const, color: team1Color }));
  const t2 = TEAM2_PLAYERS.map((p) => ({ ...p, team: 2 as const, color: team2Color }));
  const foulingTeamPlayers = wizard.foulTeam === 1 ? t1 : t2;
  const otherTeamPlayers   = wizard.foulTeam === 1 ? t2 : t1;
  const foulingTeamName    = wizard.foulTeam === 1 ? team1Name : team2Name;
  const otherTeamName      = wizard.foulTeam === 1 ? team2Name : team1Name;

  const allFTDone = ftResults.length > 0 && ftResults.every((r) => r !== null);

  // ── Panel helpers ──────────────────────────────────────────────────────────
  const Panel = ({ active, children, style }: { active: boolean; children: React.ReactNode; style?: React.CSSProperties }) => (
    <div className={`bg-white rounded-lg flex flex-col ${active ? '' : 'opacity-50 pointer-events-none'}`}
      style={{ minHeight: 300, ...style }}>
      {children}
    </div>
  );

  const PanelHeader = ({ text }: { text: string }) => (
    <div className="px-4 py-2 border-b border-gray-100">
      <p className="text-blue-700 text-sm font-semibold text-center tracking-wide">{text}</p>
    </div>
  );

  const PLabel = ({ label, active }: { label: string; active: boolean }) => (
    <p className={`text-xs font-bold tracking-widest uppercase px-1 ${active ? 'text-white' : 'text-gray-500 opacity-50'}`}>{label}</p>
  );

  const PlayerList = ({ players, onSelect }: { players: (PlayerInfo & { team: 1 | 2 })[]; onSelect: (f: FoulLabel) => void }) => (
    <div className="flex-1 overflow-y-auto px-2 py-1">
      {players.map((p) => (
        <button key={`${p.team}-${p.num}`}
          onClick={() => onSelect({ label: `#${p.num} ${p.name}`, team: p.team, num: p.num })}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded transition-colors text-left"
        >
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: p.color }}>{p.num}</span>
          <span className="text-sm text-gray-800">{p.name}</span>
        </button>
      ))}
    </div>
  );

  // ── Group 1: steps 0-2 ────────────────────────────────────────────────────
  if (step <= 2) {
    return (
      <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
        <div className="w-full max-w-5xl px-6">
          {/* Label bar */}
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">FOUL FLOW MODALS</p>
          <div className="grid grid-cols-3 gap-4 mb-2">
            <PLabel label="SELECT PLAYER FOR FOUL"  active={step === 0} />
            <PLabel label="FOUL TYPE"                active={step === 1} />
            <PLabel label="FREE THROWS AWARDED"      active={step === 2} />
          </div>
          <div className="grid grid-cols-3 gap-4">

            {/* Panel 0 — Fouler */}
            <Panel active={step === 0}>
              <PanelHeader text={step === 0 ? 'SELECT PLAYER FOR FOUL' : fouler?.label ?? '—'} />
              <div className="flex-1 overflow-y-auto px-2 py-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{foulingTeamName}</p>
                {foulingTeamPlayers.map((p) => (
                  <button key={p.num}
                    onClick={() => onSelectFouler({ label: `#${p.num} ${p.name}`, team: p.team, num: p.num })}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded transition-colors text-left"
                  >
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: p.color }}>{p.num}</span>
                    <span className="text-sm text-gray-800">{p.name}</span>
                  </button>
                ))}
                {/* Bench / Coach */}
                <div className="mt-2 flex gap-2 px-3">
                  {(['BENCH', 'COACH'] as const).map((type) => (
                    <button key={type}
                      onClick={() => onSelectFouler({ label: type, team: wizard.foulTeam })}
                      className="flex-1 py-1.5 bg-gray-700 text-white text-xs font-bold rounded hover:bg-gray-600 transition-colors">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <WizardNav onCancel={onCancel} showBack={false} />
            </Panel>

            {/* Panel 1 — Foul type */}
            <Panel active={step === 1}>
              <PanelHeader text={step <= 1 ? 'SELECT FOUL TYPE' : foulType ?? '—'} />
              <div className="flex-1 px-4 py-4">
                <div className="grid grid-cols-2 gap-2">
                  {FOUL_TYPES_WIZARD.map((t) => (
                    <button key={t} onClick={() => onSelectFoulType(t)}
                      className="py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <WizardNav onBack={onBack} onCancel={onCancel} />
            </Panel>

            {/* Panel 2 — Receiver */}
            <Panel active={step === 2}>
              <PanelHeader text={step === 2 ? 'SELECT PLAYER FOR RECEIVED FOUL' : receiver?.label ?? '—'} />
              <div className="flex-1 overflow-y-auto px-2 py-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{otherTeamName}</p>
                <PlayerList players={otherTeamPlayers} onSelect={onSelectReceiver} />
              </div>
              <WizardNav onBack={onBack} onCancel={onCancel} />
            </Panel>

          </div>
        </div>
      </div>
    );
  }

  // ── Group 2: steps 3-5 ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-5xl px-6">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">FOUL FLOW MODALS</p>
        <div className="grid grid-cols-3 gap-4 mb-2">
          <PLabel label="FREE THROWS AWARDED" active={step === 3} />
          <PLabel label="PLAYER FOR ASSIST"   active={step === 4} />
          <PLabel label="FREE THROW RESULTS"  active={step === 5} />
        </div>
        <div className="grid grid-cols-3 gap-4">

          {/* Panel 3 — FT count */}
          <Panel active={step === 3}>
            <PanelHeader text={step === 3 ? 'SELECT NUMBER OF FREE THROWS AWARDED' : freeThrowCount > 0 ? `${freeThrowCount} Free Throw${freeThrowCount > 1 ? 's' : ''}` : 'No Free Throw'} />
            <div className="flex-1 px-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                {([1, 2, 3] as const).map((n) => (
                  <button key={n} onClick={() => onSelectFTCount(n)}
                    className="py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm">
                    {n} Free Throw{n > 1 ? 's' : ''}
                  </button>
                ))}
                <button onClick={() => onSelectFTCount(0)}
                  className="py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:border-red-400 hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm col-span-2">
                  No Free Throw
                </button>
              </div>
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </Panel>

          {/* Panel 4 — Assist */}
          <Panel active={step === 4}>
            <PanelHeader text="SELECT PLAYER FOR ASSIST" />
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <button onClick={() => onSelectAssist('none')}
                className="w-full text-center py-2 text-sm text-gray-400 hover:bg-gray-50 rounded transition-colors font-medium border border-dashed border-gray-300 mt-1 mb-2">
                No Assist
              </button>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{otherTeamName}</p>
              <PlayerList players={otherTeamPlayers} onSelect={(f) => onSelectAssist(f)} />
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{foulingTeamName}</p>
              <PlayerList players={foulingTeamPlayers} onSelect={(f) => onSelectAssist(f)} />
            </div>
            <WizardNav onBack={onBack} onCancel={onCancel} />
          </Panel>

          {/* Panel 5 — Free throw results */}
          <Panel active={step === 5}>
            <PanelHeader text="ENTER FREE THROW RESULTS" />
            <div className="flex-1 px-4 py-4 flex flex-col gap-3">
              {Array.from({ length: freeThrowCount }, (_, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Attempt {i + 1}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSetFTResult(i, true)}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                        ftResults[i] === true ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}>
                      Made
                    </button>
                    <button
                      onClick={() => onSetFTResult(i, false)}
                      className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
                        ftResults[i] === false ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}>
                      Missed
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 px-4 py-2 flex justify-between items-center">
              <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                <FiArrowLeft size={13} /> Back
              </button>
              {allFTDone && (
                <button onClick={onComplete}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors">
                  Complete
                </button>
              )}
              <button onClick={onCancel} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors">
                <FiX size={13} /> Cancel
              </button>
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
};

// ─── Player number tile ────────────────────────────────────────────────────────
const PlayerTile: React.FC<{
  num: number; color: string; selected: boolean; onClick: () => void;
}> = ({ num, color, selected, onClick }) => (
  <button onClick={onClick}
    className={`w-14 h-14 rounded flex items-center justify-center text-white font-bold text-2xl transition-all select-none ${
      selected ? 'ring-4 ring-white ring-offset-1 brightness-75 scale-105' : 'hover:opacity-90'
    }`}
    style={{ backgroundColor: color }}
  >
    {num}
  </button>
);

const ActionBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick}
    className="w-full py-1.5 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm tracking-wide"
  >
    {label}
  </button>
);

// ─── Player stats table ────────────────────────────────────────────────────────
const PlayerStatsTable: React.FC<{
  players: Array<{ num: number; name: string }>;
  team: 1 | 2;
  color: string;
  selectedNum: number | null;
  onSelect: (n: number) => void;
  stats: Record<string, { pts: number; pf: number }>;
}> = ({ players, team, color, selectedNum, onSelect, stats }) => (
  <div className="w-full overflow-hidden rounded-sm border border-blue-100 text-[11px] shrink-0">
    {/* Header */}
    <div className="flex bg-[#EEF2FF] border-b border-blue-100">
      <div className="w-7 px-1.5 py-2 text-blue-700 font-bold">#</div>
      <div className="flex-1 px-1.5 py-2 text-blue-700 font-bold">PLAYER NAME</div>
      <div className="w-8 px-1 py-2 text-blue-700 font-bold text-center">PF</div>
      <div className="w-9 px-1 py-2 text-blue-700 font-bold text-center">PTS</div>
    </div>
    {/* Rows */}
    {players.map((p, i) => {
      const isSelected = selectedNum === p.num;
      const s = stats[`${team}-${p.num}`] ?? { pts: 0, pf: 0 };
      return (
        <div
          key={p.num}
          onClick={() => onSelect(p.num)}
          className={`flex items-center cursor-pointer transition-colors ${
            isSelected ? '' : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'
          }`}
          style={isSelected ? { backgroundColor: `${color}28` } : {}}
        >
          <div className="w-7 px-1.5 py-2 text-blue-600 font-semibold">{p.num}</div>
          <div className="flex-1 px-1.5 py-2 text-blue-600 truncate">{p.name}</div>
          <div className={`w-8 px-1 py-2 text-center font-semibold ${s.pf > 0 ? 'text-red-500' : 'text-gray-400'}`}>{s.pf}</div>
          <div className={`w-9 px-1 py-2 text-center font-semibold ${s.pts > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{s.pts}</div>
        </div>
      );
    })}
  </div>
);


// ─── CourtSection ──────────────────────────────────────────────────────────────
const WIZARD_INIT: WizardData = {
  courtX: 0, courtY: 0,
  step: 0, player: null, shotOption: null, fastBreak: false,
};

const CourtSection: React.FC<CourtSectionProps> = ({
  team1Color, team2Color,
  team1Name = 'TEAM 1', team2Name = 'TEAM 2',
  possession, onTogglePossession,
  selectedTeam1Player, selectedTeam2Player,
  onSelectTeam1Player, onSelectTeam2Player,
  onFoul1, onTurnover1, onFoul2, onTurnover2,
  onAddEvent,
}) => {
  const [markers,         setMarkers]         = useState<CourtMarker[]>([]);
  const [wizard,          setWizard]          = useState<WizardData | null>(null);
  const [missedWizard,    setMissedWizard]    = useState<MissedWizardData | null>(null);
  const [foulWizard,      setFoulWizard]      = useState<FoulWizardData | null>(null);
  const [turnoverWizard,  setTurnoverWizard]  = useState<TurnoverWizardData | null>(null);

  // ── Per-player live stats ─────────────────────────────────────────────────
  // key = `${team}-${num}`  e.g. "1-5"
  const [playerStats, setPlayerStats] = useState<Record<string, { pts: number; pf: number }>>({});

  const statKey = (team: 1 | 2, num: number) => `${team}-${num}`;

  const addPts = (team: 1 | 2, num: number, pts: number) =>
    setPlayerStats((prev) => {
      const k = statKey(team, num);
      return { ...prev, [k]: { pts: (prev[k]?.pts ?? 0) + pts, pf: prev[k]?.pf ?? 0 } };
    });

  const addPf = (team: 1 | 2, num: number) =>
    setPlayerStats((prev) => {
      const k = statKey(team, num);
      return { ...prev, [k]: { pts: prev[k]?.pts ?? 0, pf: (prev[k]?.pf ?? 0) + 1 } };
    });

  // ── Right-click → made-shot wizard ────────────────────────────────────────
  const handleRightClick = useCallback((x: number, y: number) => {
    setMissedWizard(null);
    setWizard({ ...WIZARD_INIT, courtX: x, courtY: y });
  }, []);

  // ── Left-click → missed-shot wizard ───────────────────────────────────────
  const handleLeftClick = useCallback((x: number, y: number, _sx: number, _sy: number) => {
    setWizard(null);
    setMissedWizard({ ...MISSED_INIT, courtX: x, courtY: y });
  }, []);

  // ── Wizard navigation ──────────────────────────────────────────────────────
  const wizardSelectPlayer = (p: WizardData['player']) =>
    setWizard((w) => w ? { ...w, step: 1, player: p } : w);

  const wizardSelectShot = (s: typeof SHOT_OPTIONS[number]) =>
    setWizard((w) => w ? { ...w, step: 2, shotOption: s } : w);

  const wizardToggleFastBreak = () =>
    setWizard((w) => w ? { ...w, fastBreak: !w.fastBreak } : w);

  const wizardBack = () =>
    setWizard((w) => w ? { ...w, step: Math.max(0, w.step - 1) as WizardStep } : w);

  const wizardCancel = () => setWizard(null);

  const wizardSelectAssist = (assist: WizardData['player'] | null) => {
    if (!wizard?.player || !wizard?.shotOption) return;

    const { player, shotOption, fastBreak, courtX, courtY } = wizard;
    const teamStr = player.team === 1 ? 'Team 1' : 'Team 2';
    const playerStr = `#${player.num} ${player.name}`;
    const resultStr = `${shotOption.name}${fastBreak ? ' (fast break)' : ''} — ${shotOption.points}pt`;
    const assistStr = assist ? `Assist: #${assist.num} ${assist.name}` : '';

    // Credit points to player
    addPts(player.team, player.num, shotOption.points);

    // Add shot marker on court
    setMarkers((prev) => [...prev, {
      id: Date.now().toString(),
      x: courtX, y: courtY,
      type: 'shot',
      color: shotOption.color,
      label: shotOption.name,
      playerNum: player.num,
      playerTeam: player.team,
    }]);

    // Log in game log
    onAddEvent?.(teamStr, playerStr, shotOption.name, assistStr || resultStr);

    setWizard(null);
  };

  // ── Missed-shot wizard handlers ────────────────────────────────────────────
  const missedSelectPlayer = (p: PlayerInfo) =>
    setMissedWizard((w) => w ? { ...w, step: 1, player: p } : w);

  const missedSelectShot = (shotName: string) =>
    setMissedWizard((w) => w ? { ...w, step: 2, shotOption: shotName } : w);

  const missedToggleFastBreak = () =>
    setMissedWizard((w) => w ? { ...w, fastBreak: !w.fastBreak } : w);

  const missedSelectRebound = (outcome: string) => {
    if (!missedWizard?.player || !missedWizard?.shotOption) return;
    if (outcome === 'Blocked') {
      setMissedWizard((w) => w ? { ...w, step: 3, reboundOutcome: 'Blocked' } : w);
      return;
    }
    // Non-blocked outcomes → record and close
    const { player, shotOption, fastBreak, courtX, courtY } = missedWizard;
    const teamStr   = player.team === 1 ? team1Name : team2Name;
    const playerStr = `#${player.num} ${player.name}`;
    setMarkers((prev) => [...prev, { id: Date.now().toString(), x: courtX, y: courtY, type: 'missed', color: '#6b7280', label: shotOption, playerNum: player.num, playerTeam: player.team }]);
    onAddEvent?.(teamStr, playerStr, `${shotOption} (missed)`, `${outcome}${fastBreak ? ' • fast break' : ''}`);
    setMissedWizard(null);
  };

  const missedSelectBlockPlayer = (p: PlayerInfo) =>
    setMissedWizard((w) => w ? { ...w, step: 4, blockPlayer: p } : w);

  const missedSelectMissedPlayer = (p: PlayerInfo) => {
    if (!missedWizard?.player || !missedWizard?.shotOption || !missedWizard?.blockPlayer) return;
    const { player, shotOption, fastBreak, blockPlayer, courtX, courtY } = missedWizard;
    const attackTeam  = player.team === 1 ? team1Name : team2Name;
    const blockTeam   = blockPlayer.team === 1 ? team1Name : team2Name;
    setMarkers((prev) => [...prev, { id: Date.now().toString(), x: courtX, y: courtY, type: 'missed', color: '#dc2626', label: 'Blocked', playerNum: player.num, playerTeam: player.team }]);
    onAddEvent?.(attackTeam, `#${player.num} ${player.name}`, `${shotOption} blocked`, `Blocked by #${blockPlayer.num} ${blockPlayer.name} (${blockTeam})${fastBreak ? ' • fast break' : ''}`);
    onAddEvent?.(blockTeam, `#${blockPlayer.num} ${blockPlayer.name}`, 'block', `Against #${p.num} ${p.name}`);
    setMissedWizard(null);
  };

  const missedBack = () =>
    setMissedWizard((w) => {
      if (!w) return w;
      if (w.step === 4) return { ...w, step: 3 };
      if (w.step === 3) return { ...w, step: 2 };
      return { ...w, step: Math.max(0, w.step - 1) as MissedStep };
    });

  const missedCancel = () => setMissedWizard(null);

  // ── Foul wizard handlers ───────────────────────────────────────────────────
  const openFoulWizard = (team: 1 | 2) => {
    setWizard(null);
    setMissedWizard(null);
    setFoulWizard(mkFoulInit(team));
  };

  const foulSelectFouler = (f: FoulLabel) =>
    setFoulWizard((w) => w ? { ...w, step: 1, fouler: f } : w);

  const foulSelectType = (t: string) =>
    setFoulWizard((w) => w ? { ...w, step: 2, foulType: t } : w);

  const foulSelectReceiver = (f: FoulLabel) =>
    setFoulWizard((w) => w ? { ...w, step: 3, receiver: f } : w);

  const foulSelectFTCount = (n: 0 | 1 | 2 | 3) => {
    if (n === 0) {
      // No free throws — complete immediately; charge the fouler a PF
      if (foulWizard) {
        const { foulTeam, fouler, foulType, receiver } = foulWizard;
        const teamName = foulTeam === 1 ? team1Name : team2Name;
        onAddEvent?.(teamName, fouler?.label ?? '', `${foulType ?? ''} foul`, receiver ? `on ${receiver.label}` : '');
        if (fouler?.num) addPf(foulTeam, fouler.num);
      }
      setFoulWizard(null);
      return;
    }
    setFoulWizard((w) => w ? { ...w, step: 4, freeThrowCount: n, ftResults: Array(n).fill(null) } : w);
  };

  const foulSelectAssist = (a: FoulLabel | 'none') =>
    setFoulWizard((w) => w ? { ...w, step: 5, assist: a } : w);

  const foulSetFTResult = (idx: number, made: boolean) =>
    setFoulWizard((w) => {
      if (!w) return w;
      const r = [...w.ftResults];
      r[idx] = made;
      return { ...w, ftResults: r };
    });

  const foulComplete = () => {
    if (!foulWizard) return;
    const { foulTeam, fouler, foulType, receiver, freeThrowCount, assist, ftResults } = foulWizard;
    const teamName = foulTeam === 1 ? team1Name : team2Name;
    const receiverTeam = receiver?.team === 1 ? team1Name : team2Name;
    // Foul event — charge the fouler a PF
    onAddEvent?.(teamName, fouler?.label ?? '', `${foulType} foul`, receiver ? `on ${receiver.label}` : '');
    if (fouler?.num) addPf(foulTeam, fouler.num);
    // Free throw results — credit the receiver 1pt per made FT
    ftResults.forEach((made, i) => {
      if (made !== null) {
        const assistNote = i === 0 && assist !== 'none' && assist ? ` | Assist: ${assist.label}` : '';
        onAddEvent?.(receiverTeam ?? '', receiver?.label ?? '', `FT ${i + 1}/${freeThrowCount}`, (made ? 'Made' : 'Missed') + assistNote);
        if (made && receiver?.num) addPts(receiver.team, receiver.num, 1);
      }
    });
    setFoulWizard(null);
  };

  const foulBack = () =>
    setFoulWizard((w) => w ? { ...w, step: Math.max(0, w.step - 1) as FoulStep } : w);

  const foulCancel = () => setFoulWizard(null);

  // ── Turnover wizard handlers ───────────────────────────────────────────────
  const openTurnoverWizard = (team: 1 | 2) => {
    setWizard(null);
    setMissedWizard(null);
    setFoulWizard(null);
    setTurnoverWizard(mkTurnoverInit(team));
  };

  const turnoverSelectPlayer = (f: FoulLabel) =>
    setTurnoverWizard((w) => w ? { ...w, step: 1, player: f } : w);

  const turnoverSelectType = (t: string) =>
    setTurnoverWizard((w) => w ? { ...w, step: 2, turnoverType: t } : w);

  const turnoverSelectSteal = (s: FoulLabel | 'none') => {
    if (!turnoverWizard?.player || !turnoverWizard?.turnoverType) return;
    const { player, turnoverType, turnoverTeam } = turnoverWizard;
    const teamName = turnoverTeam === 1 ? team1Name : team2Name;
    const stealNote = s === 'none' ? '' : `Steal: ${s.label}`;
    onAddEvent?.(teamName, player.label, `turnover`, `${turnoverType}${stealNote ? ` | ${stealNote}` : ''}`);
    if (s !== 'none') {
      const stealTeamName = s.team === 1 ? team1Name : team2Name;
      onAddEvent?.(stealTeamName, s.label, 'steal', `From ${player.label}`);
    }
    setTurnoverWizard(null);
  };

  const turnoverBack = () =>
    setTurnoverWizard((w) => w ? { ...w, step: Math.max(0, w.step - 1) as TurnoverStep } : w);

  const turnoverCancel = () => setTurnoverWizard(null);

  // Show only the selected player's markers; show all when no one is selected
  const visibleMarkers = markers.filter((m) => {
    if (m.playerTeam === 1 && selectedTeam1Player !== null && m.playerNum !== selectedTeam1Player) return false;
    if (m.playerTeam === 2 && selectedTeam2Player !== null && m.playerNum !== selectedTeam2Player) return false;
    return true;
  });

  return (
    <>
      <div className="h-full flex items-stretch bg-[#F0F2F5] px-1 py-1">

        {/* Team 1 stats column */}
        <div className="flex flex-col gap-1 shrink-0 w-52 pr-1">
          <PlayerStatsTable
            players={TEAM1_PLAYERS}
            team={1}
            color={team1Color}
            selectedNum={selectedTeam1Player}
            onSelect={onSelectTeam1Player}
            stats={playerStats}
          />
          <div className="flex flex-col gap-1">
            <ActionBtn label="FOUL"     onClick={() => openFoulWizard(1)} />
            <ActionBtn label="TURNOVER" onClick={() => openTurnoverWizard(1)} />
          </div>
        </div>

        {/* Interactive court + possession toggle */}
        <div className="flex-1 mx-2 min-w-0 overflow-hidden flex flex-col">
          {/* Possession bar */}
          <div className="flex items-center justify-center gap-2 py-1 shrink-0">
            <button
              onClick={onTogglePossession}
              className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                possession === 1
                  ? 'text-white shadow'
                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
              }`}
              style={possession === 1 ? { backgroundColor: team1Color } : {}}
            >
              {team1Name} ◀
            </button>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">BALL</span>
            <button
              onClick={onTogglePossession}
              className={`px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                possession === 2
                  ? 'text-white shadow'
                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
              }`}
              style={possession === 2 ? { backgroundColor: team2Color } : {}}
            >
              ▶ {team2Name}
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <GrayCourt
              onCourtLeftClick={handleLeftClick}
              onCourtRightClick={handleRightClick}
              markers={visibleMarkers}
            />
          </div>
        </div>

        {/* Team 2 stats column */}
        <div className="flex flex-col gap-1 shrink-0 w-52 pl-1">
          <PlayerStatsTable
            players={TEAM2_PLAYERS}
            team={2}
            color={team2Color}
            selectedNum={selectedTeam2Player}
            onSelect={onSelectTeam2Player}
            stats={playerStats}
          />
          <div className="flex flex-col gap-1">
            <ActionBtn label="FOUL"     onClick={() => openFoulWizard(2)} />
            <ActionBtn label="TURNOVER" onClick={() => openTurnoverWizard(2)} />
          </div>
        </div>
      </div>

      {/* Made-shot wizard (right-click) */}
      {wizard && (
        <ShotWizard
          wizard={wizard}
          team1Color={team1Color}
          team2Color={team2Color}
          team1Name={team1Name}
          team2Name={team2Name}
          possession={possession}
          onSelectPlayer={wizardSelectPlayer}
          onSelectShot={wizardSelectShot}
          onToggleFastBreak={wizardToggleFastBreak}
          onSelectAssist={wizardSelectAssist}
          onBack={wizardBack}
          onCancel={wizardCancel}
        />
      )}

      {/* Turnover wizard (TURNOVER button) */}
      {turnoverWizard && (
        <TurnoverWizard
          wizard={turnoverWizard}
          team1Color={team1Color}
          team2Color={team2Color}
          team1Name={team1Name}
          team2Name={team2Name}
          onSelectPlayer={turnoverSelectPlayer}
          onSelectType={turnoverSelectType}
          onSelectSteal={turnoverSelectSteal}
          onBack={turnoverBack}
          onCancel={turnoverCancel}
        />
      )}

      {/* Foul wizard (FOUL button) */}
      {foulWizard && (
        <FoulWizard
          wizard={foulWizard}
          team1Color={team1Color}
          team2Color={team2Color}
          team1Name={team1Name}
          team2Name={team2Name}
          onSelectFouler={foulSelectFouler}
          onSelectFoulType={foulSelectType}
          onSelectReceiver={foulSelectReceiver}
          onSelectFTCount={foulSelectFTCount}
          onSelectAssist={foulSelectAssist}
          onSetFTResult={foulSetFTResult}
          onComplete={foulComplete}
          onBack={foulBack}
          onCancel={foulCancel}
        />
      )}

      {/* Missed-shot wizard (left-click) */}
      {missedWizard && (
        <MissedShotWizard
          wizard={missedWizard}
          team1Color={team1Color}
          team2Color={team2Color}
          team1Name={team1Name}
          team2Name={team2Name}
          possession={possession}
          onSelectPlayer={missedSelectPlayer}
          onSelectShot={missedSelectShot}
          onToggleFastBreak={missedToggleFastBreak}
          onSelectRebound={missedSelectRebound}
          onSelectBlockPlayer={missedSelectBlockPlayer}
          onSelectMissedPlayer={missedSelectMissedPlayer}
          onBack={missedBack}
          onCancel={missedCancel}
        />
      )}
    </>
  );
};

export default CourtSection;
