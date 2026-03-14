import React from 'react';
import type { GameEvent } from '../StatDash';

interface GameLogProps {
  events: GameEvent[];
}

const HEADERS = ['Period', 'Clock', 'Team', 'Player', 'Action', 'Result'];

const GameLog: React.FC<GameLogProps> = ({ events }) => (
  <div className="h-28 shrink-0 overflow-y-auto border-t border-gray-200 bg-white">
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10">
        <tr style={{ backgroundColor: '#1E4DB7' }}>
          {HEADERS.map((h) => (
            <th
              key={h}
              className="text-white text-xs font-semibold px-4 py-2.5 text-left tracking-wide"
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
            <td className="px-4 py-2 text-gray-600 text-xs">{event.period}</td>
            <td className="px-4 py-2 text-gray-600 text-xs">{event.clock}</td>
            <td className="px-4 py-2 text-gray-700 text-xs font-medium">{event.team}</td>
            <td className="px-4 py-2 text-blue-700 text-xs font-semibold">{event.player}</td>
            <td className="px-4 py-2 text-gray-700 text-xs">{event.action}</td>
            <td className="px-4 py-2 text-gray-700 text-xs">{event.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default GameLog;
