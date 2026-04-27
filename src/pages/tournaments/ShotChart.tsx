import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShotChartProjection } from '../../services/statdash';

const ShotChart: React.FC = () => {
  const { id, matchId } = useParams();
  const [activeQuarter, setActiveQuarter] = useState('all');
  const shotChartQuery = useShotChartProjection(matchId, !!matchId);
  const shots = shotChartQuery.data ?? [];
  const filteredShots = activeQuarter === 'all'
    ? shots
    : shots.filter((shot) => shot.period === Number(activeQuarter.replace('q', '')));

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Quarter Filters */}
        <div className="flex justify-center gap-3 mb-6">
          <button 
            onClick={() => setActiveQuarter('all')}
            className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
              activeQuarter === 'all'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveQuarter('q1')}
            className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
              activeQuarter === 'q1'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Q1
          </button>
          <button 
            onClick={() => setActiveQuarter('q2')}
            className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
              activeQuarter === 'q2'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Q2
          </button>
          <button 
            onClick={() => setActiveQuarter('q3')}
            className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
              activeQuarter === 'q3'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Q3
          </button>
          <button 
            onClick={() => setActiveQuarter('q4')}
            className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
              activeQuarter === 'q4'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Q4
          </button>
        </div>

        {/* Basketball Court with Shot Chart */}
        <div className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg p-8 mb-6 border border-gray-200">
          {shotChartQuery.isPending && (
            <div className="mb-3 text-sm text-gray-600">Loading shot chart...</div>
          )}
          {shotChartQuery.error instanceof Error && (
            <div className="mb-3 text-sm text-red-600">{shotChartQuery.error.message}</div>
          )}
          <div className="bg-[#4A90E2] rounded-lg p-4 max-w-3xl mx-auto relative" style={{ aspectRatio: '16/10' }}>
            {/* Basketball court lines and circles would be SVG overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-sm opacity-80">
                {filteredShots.length} shot(s) in {activeQuarter.toUpperCase()}
              </div>
            </div>
            {/* Shot markers would be positioned absolutely based on coordinates */}
          </div>
          
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
              <span className="w-3 h-3 bg-orange-400 rounded-full"></span>
              <span className="text-sm text-gray-700">Made</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
              <span className="text-gray-600 text-lg">✕</span>
              <span className="text-sm text-gray-700">Missed</span>
            </label>
          </div>
        </div>

        {/* Player Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Player 1 - Yellow */}
          <div className="rounded-2xl overflow-hidden bg-[#FFCA69]" style={{ width: '335px', height: '374px' }}>
            <div className="p-4">
              <div className="text-white font-medium mb-1">Name</div>
              <div className="text-white font-bold text-lg mb-1">Surname</div>
              <div className="bg-white text-gray-900 font-bold text-sm px-3 py-1 rounded-md inline-block mb-4">
                11
              </div>
              <div className="bg-white rounded-full px-4 py-2 inline-block">
                <div className="text-xs text-gray-500">FG%</div>
                <div className="text-sm font-bold text-gray-800">50%</div>
                <div className="text-xs text-gray-500">(10/20)</div>
              </div>
            </div>
            <div className="relative" style={{ height: '400px' }}>
              <img
                src="/player1.png"
                alt="Player"
                className="w-[21rem] ml-0 mx-auto absolute mt-[-3.5rem]"
              />
            </div>
          </div>

          {/* Player 2 - Blue */}
          <div className="rounded-2xl overflow-hidden bg-[#80B7D5]" style={{ width: '335px', height: '374px' }}>
            <div className="p-4">
              <div className="text-white font-medium mb-1">Name</div>
              <div className="text-white font-bold text-lg mb-1">Surname</div>
              <div className="bg-white text-gray-900 font-bold text-sm px-3 py-1 rounded-md inline-block mb-4">
                23
              </div>
              <div className="bg-white rounded-full px-4 py-2 inline-block">
                <div className="text-xs text-gray-500">FG%</div>
                <div className="text-sm font-bold text-gray-800">50%</div>
                <div className="text-xs text-gray-500">(10/20)</div>
              </div>
            </div>
            <div className="relative" style={{ height: '400px' }}>
              <img
                src="/player2.png"
                alt="Player"
                className="w-[21rem] ml-0 mx-auto absolute mt-[-3.5rem]"
              />
            </div>
          </div>
        </div>

        {/* Player Selection Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team A Players */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
              <span className="text-sm font-medium text-gray-700">All Players</span>
            </label>
            {[1, 2, 3, 4, 5].map((i) => (
              <label key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
                <span className="text-sm text-gray-700">Name Surname</span>
              </label>
            ))}
          </div>

          {/* Team B Players */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">All Players</span>
            </label>
            {[1, 2, 3, 4, 5].map((i) => (
              <label key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Name Surname</span>
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ShotChart;
