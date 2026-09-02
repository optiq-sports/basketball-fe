import React from 'react';
import { FiList } from 'react-icons/fi';
import { getContrastTextColor, normalizeHex } from '../../../contexts/StatisticianTeamColorsContext';
import type { TeamSide } from '../types';
import { cl } from '../utils/cl';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';

export interface PlayerPanelProps {
  side: TeamSide;
  accentColor: string;
  playerNumbers: number[];
  /** Maps jersey number → abbreviated name (e.g. "J. Smith") for display below the jersey */
  rosterByJersey?: Map<number, string>;
  /** When true, jersey numbers (and made-shot context menu) are disabled; FOUL/TURNOVER stay clickable. */
  interactionsLocked?: boolean;
  /** Left-click: primary action based on active flow state */
  onPlayerFoulClick: (side: TeamSide, jersey: number) => void;
  /** Right-click: made-shot flow (caller must preventDefault on event) */
  onPlayerShotContextMenu: (side: TeamSide, jersey: number, e: React.MouseEvent) => void;
  onFoul: (side: TeamSide) => void;
  onTurnover: (side: TeamSide) => void;
  /** Opens/closes this team's roster + stats drawer */
  onToggleRoster?: () => void;
  rosterOpen?: boolean;
}

const EXTRA = ['FOUL', 'TURNOVER'] as const;

const EXTRA_STYLE = {
  FOUL: { border: '#FCD34D', bg: '#FFFBEB', text: '#92400E' },
  TURNOVER: { border: '#FDA4AF', bg: '#FFF1F2', text: '#9F1239' },
} as const;

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  side,
  accentColor,
  playerNumbers,
  rosterByJersey,
  interactionsLocked = false,
  onPlayerFoulClick,
  onPlayerShotContextMenu,
  onFoul,
  onTurnover,
  onToggleRoster,
  rosterOpen = false,
}) => {
  const tileGap = cl('6px', '0.6vw', '10px');
  const panelW = cl('120px', '12.5vw', '180px');
  const normalizedAccent = normalizeHex(accentColor) ?? accentColor;
  const jerseyText = getContrastTextColor(normalizedAccent);

  return (
    <div className="flex shrink-0 flex-col font-sans" style={{ gap: tileGap, width: panelW }}>
      {onToggleRoster && (
        <button
          type="button"
          onClick={onToggleRoster}
          className={`flex w-full items-center justify-center gap-1.5 border font-bold uppercase tracking-wide shadow-sm transition-colors ${
            rosterOpen
              ? 'border-slate-500 bg-slate-700 text-white'
              : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
          }`}
          style={{
            padding: `${cl('6px', '0.7vh', '10px')} ${cl('4px', '0.4vw', '6px')}`,
            fontSize: cl('9px', '0.85vw', '12px'),
            letterSpacing: 0.45,
          }}
          aria-pressed={rosterOpen}
        >
          <FiList size={13} />
          Roster
        </button>
      )}
      <div
        className="grid grid-cols-2"
        style={{ gap: tileGap }}
      >
        {playerNumbers.map((n, idx) => {
          const name = rosterByJersey?.get(n);
          return (
            <button
              key={`${side}-jersey-${idx}-${n}`}
              type="button"
              disabled={interactionsLocked}
              onClick={() => onPlayerFoulClick(side, n)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (interactionsLocked) return;
                onPlayerShotContextMenu(side, n, e);
              }}
              className="flex aspect-square shrink-0 cursor-pointer select-none items-center justify-center border-none font-bold leading-none shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-80"
              style={{
                background: normalizedAccent,
                color: jerseyText,
                fontSize: cl('22px', '2.6vw', '38px'),
                fontFamily: GATEWAY_DISPLAY_FONT_STACK,
              }}
              aria-label={`${side} player ${n}${name ? ` (${name})` : ''}. Left-click: select player. Right-click: made shot.`}
              title={name}
            >
              {n}
            </button>
          );
        })}
      </div>
      {EXTRA.map((lbl) => (
        <button
          key={lbl}
          type="button"
          onClick={() => (lbl === 'FOUL' ? onFoul(side) : onTurnover(side))}
          className="w-full cursor-pointer border font-bold uppercase tracking-wide shadow-sm transition-all hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          style={{
            padding: `${cl('6px', '0.7vh', '10px')} ${cl('4px', '0.4vw', '6px')}`,
            fontSize: cl('9px', '0.85vw', '12px'),
            letterSpacing: lbl === 'TURNOVER' ? 0.15 : 0.45,
            lineHeight: 1.15,
            borderColor: EXTRA_STYLE[lbl].border,
            background: EXTRA_STYLE[lbl].bg,
            color: EXTRA_STYLE[lbl].text,
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
};

export default PlayerPanel;
