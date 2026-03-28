import React from 'react';
import type { GameLogEntry } from '../types';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

export interface GameLogProps {
  entries: GameLogEntry[];
}

const COLUMNS = ['Period', 'Clock', 'Team', 'Player', 'Action', 'Result'] as const;
/** Shared column widths so header and body tables stay aligned */
const COL_WIDTHS = ['9%', '11%', '14%', '24%', '20%', '22%'] as const;

const tableBaseClass =
  'w-full min-w-0 max-w-full border-separate border-spacing-0 bg-white font-sans table-fixed';

function ColGroup() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const cellPad = `${cl('4px', '0.5vh', '7px')} ${cl('6px', '0.8vw', '11px')}`;
  const fontSize = cl('10px', '0.85vw', '12px');

  const headerCellStyle: React.CSSProperties = {
    padding: cellPad,
    letterSpacing: 0.4,
    background: STAT_DASH.accentBlue,
    color: 'white',
    borderBottom: `1px solid ${STAT_DASH.accentBlue}`,
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ fontSize }}
    >
      {/* Header: never scrolls */}
      <div className="shrink-0 overflow-hidden border-b border-gray-200">
        <table className={tableBaseClass}>
          <ColGroup />
          <thead>
            <tr>
              {COLUMNS.map((h) => (
                <th key={h} className="text-left font-bold" style={headerCellStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body: only this region scrolls */}
      <div className="statdash-log-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain">
        <table className={tableBaseClass}>
          <ColGroup />
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-gray-500"
                  style={{
                    padding: cellPad,
                    background: 'white',
                    borderBottom: `1px solid ${STAT_DASH.cardBorder}`,
                  }}
                >
                  No events yet. Use player buttons or game actions to log plays.
                </td>
              </tr>
            ) : (
              entries.map((row, i) => (
                <tr key={row.id}>
                  {[row.period, row.clock, row.team, row.player, row.action, row.result].map((v, j) => (
                    <td
                      key={j}
                      className="overflow-hidden text-left break-words text-gray-800"
                      style={{
                        padding: cellPad,
                        background: i % 2 === 0 ? 'white' : STAT_DASH.logZebra,
                        borderBottom: `1px solid ${STAT_DASH.cardBorder}`,
                      }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GameLog;
