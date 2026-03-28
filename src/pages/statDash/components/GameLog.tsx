import React from 'react';
import type { GameLogEntry } from '../types';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

export interface GameLogProps {
  entries: GameLogEntry[];
}

const COLUMNS = ['Period', 'Clock', 'Team', 'Player', 'Action', 'Result'] as const;
/** Shared column widths — Player widest (reference) */
const COL_WIDTHS = ['8%', '10%', '12%', '32%', '17%', '21%'] as const;

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

function cellText(v: string | undefined): string {
  const s = (v ?? '').trim();
  return s;
}

const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const cellPadY = cl('4px', '0.45vh', '6px');
  const cellPadX = cl('8px', '1vw', '14px');
  const cellPad = `${cellPadY} ${cellPadX}`;
  const headerPad = `${cl('8px', '0.9vh', '12px')} ${cellPadX}`;
  const bodyFontSize = cl('9px', '0.78vw', '11px');
  const headerFontSize = cl('10px', '0.88vw', '12px');

  const headerCellStyle: React.CSSProperties = {
    padding: headerPad,
    letterSpacing: 0.35,
    background: STAT_DASH.accentBlue,
    color: 'white',
    fontSize: headerFontSize,
    fontWeight: 600,
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden font-sans">
      {/* Header: never scrolls; no grid lines (reference) */}
      <div className="shrink-0 overflow-hidden">
        <table className={tableBaseClass} style={{ fontSize: headerFontSize }}>
          <ColGroup />
          <thead>
            <tr>
              {COLUMNS.map((h) => (
                <th key={h} className="text-left align-middle" style={headerCellStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body: only this region scrolls */}
      <div className="statdash-log-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain">
        <table className={tableBaseClass} style={{ fontSize: bodyFontSize }}>
          <ColGroup />
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center font-normal text-gray-500"
                  style={{
                    padding: cellPad,
                    background: 'white',
                  }}
                >
                  No events yet. Use player buttons or game actions to log plays.
                </td>
              </tr>
            ) : (
              entries.map((row, i) => (
                <tr key={row.id}>
                  {[row.period, row.clock, row.team, row.player, row.action, row.result].map((v, j) => {
                    const text = cellText(v);
                    return (
                      <td
                        key={j}
                        className="overflow-hidden text-left font-normal break-words text-gray-900"
                        style={{
                          padding: cellPad,
                          background: i % 2 === 0 ? '#ffffff' : STAT_DASH.logZebra,
                        }}
                      >
                        {text === '' ? '\u00A0' : text}
                      </td>
                    );
                  })}
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
