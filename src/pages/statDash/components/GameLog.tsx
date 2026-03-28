import React from 'react';
import type { GameLogEntry } from '../types';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

export interface GameLogProps {
  entries: GameLogEntry[];
}

const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const cellPad = `${cl('4px', '0.5vh', '7px')} ${cl('6px', '0.8vw', '11px')}`;

  return (
    <table
      className="w-full border-collapse bg-white font-sans"
      style={{
        fontSize: cl('10px', '0.85vw', '12px'),
        marginTop: 2,
      }}
    >
      <thead>
        <tr style={{ background: STAT_DASH.accentBlue, color: 'white' }}>
          {(['Period', 'Clock', 'Team', 'Player', 'Action', 'Result'] as const).map((h) => (
            <th
              key={h}
              className="text-left font-bold"
              style={{
                padding: cellPad,
                letterSpacing: 0.4,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center text-gray-500" style={{ padding: cellPad }}>
              No events yet. Use player buttons or game actions to log plays.
            </td>
          </tr>
        ) : (
          entries.map((row, i) => (
            <tr
              key={row.id}
              style={{
                background: i % 2 === 0 ? 'white' : STAT_DASH.logZebra,
                borderBottom: `1px solid ${STAT_DASH.cardBorder}`,
              }}
            >
              {[row.period, row.clock, row.team, row.player, row.action, row.result].map((v, j) => (
                <td key={j} className="text-left text-gray-800" style={{ padding: cellPad }}>
                  {v}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};

export default GameLog;
