import React from 'react';
import type { GameLogEntry } from '../types';

export interface GameLogProps {
  entries: GameLogEntry[];
  onRowClick?: (entry: GameLogEntry) => void;
}

function cellText(v: string | undefined): string {
  return (v ?? '').trim();
}

const GameLog: React.FC<GameLogProps> = ({ entries, onRowClick }) => {
  return (
    <div className="statdash-log-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain font-sans">
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs leading-relaxed text-gray-400">
          No events yet. Use player buttons or game actions to log plays.
        </p>
      ) : (
        <ul>
          {entries.map((row) => {
            const period = cellText(row.period);
            const clock = cellText(row.clock);
            const team = cellText(row.team);
            const player = cellText(row.player);
            const action = cellText(row.action);
            const result = cellText(row.result);
            const rowClassName = `block w-full px-3 py-2 text-left transition-colors ${
              onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
            }`;
            const content = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {[period, clock].filter(Boolean).join(' · ') || ' '}
                  </span>
                  {team && (
                    <span className="shrink-0 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {team}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-gray-900">
                  {[player, action].filter(Boolean).join(' — ') || ' '}
                </div>
                {result && <div className="truncate text-xs text-gray-600">{result}</div>}
              </>
            );
            return (
              <li key={row.id} className="border-b border-gray-100 last:border-b-0">
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(row)} className={rowClassName}>
                    {content}
                  </button>
                ) : (
                  <div className={rowClassName}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default GameLog;
