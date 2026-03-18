import React from 'react';
import type { GameEvent } from '../StatDash';

interface GameLogProps {
  events: GameEvent[];
}

const HEADERS = ['Period', 'Clock', 'Team', 'Player', 'Action', 'Result'];

const GameLog: React.FC<GameLogProps> = ({ events }) => (
  <div className="shrink-0 bg-gray-100 w-full flex justify-center">
    <div className="h-22 w-full max-w-[43.5rem] overflow-y-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
        <tr style={{ backgroundColor: '#1E4DB7' }}>
          {HEADERS.map((h) => (
            <th
              key={h}
              className="text-white text-[10px] font-semibold px-3 py-1.5 text-left tracking-wide uppercase"
            >
              {h}
            </th>
          ))}
        </tr>
        </thead>
        <tbody>
        {events.map((event, i) => (
          <tr
            key={event.id}
            className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
          >
            <td className="px-3 py-1 text-gray-500 text-[11px]">{event.period}</td>
            <td className="px-3 py-1 text-gray-500 text-[11px] font-mono">{event.clock}</td>
            <td className="px-3 py-1 text-gray-700 text-[11px] font-medium">{event.team}</td>
            <td className="px-3 py-1 text-blue-700 text-[11px] font-semibold">{event.player}</td>
            <td className="px-3 py-1 text-gray-700 text-[11px]">{event.action}</td>
            <td className="px-3 py-1 text-gray-600 text-[11px]">{event.result}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default GameLog;
