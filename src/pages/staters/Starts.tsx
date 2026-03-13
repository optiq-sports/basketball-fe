import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

interface MockPlayer {
  id: string;
  jerseyNumber: number;
  firstName: string;
  lastName: string;
  isStarter: boolean;
}

interface MockTeam {
  id: string;
  name: string;
  color: string;
  players: MockPlayer[];
}

const buildPlayers = (prefix: string): MockPlayer[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `${prefix}-${i}`,
    jerseyNumber: 8,
    firstName: 'Name',
    lastName: 'Surname',
    isStarter: i < 4 || i === 6,
  }));

const INITIAL_TEAMS: MockTeam[] = [
  {
    id: 'team-a',
    name: 'TEAM NAME',
    color: '#E63946',
    players: buildPlayers('a'),
  },
  {
    id: 'team-b',
    name: 'TEAM NAME',
    color: '#D4A017',
    players: buildPlayers('b'),
  },
];

const PlayerAvatar: React.FC = () => (
  <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-gray-100">
    <img src="/dplayer.png" alt="player" className="w-full h-full object-cover" />
  </div>
);

const Starts: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<MockTeam[]>(INITIAL_TEAMS);

  const toggleStarter = (teamId: string, playerId: string) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id !== teamId
          ? team
          : {
              ...team,
              players: team.players.map((p) =>
                p.id !== playerId ? p : { ...p, isStarter: !p.isStarter }
              ),
            }
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col">
      <div className="flex-1 px-6 pt-8 pb-20">
        <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto">
          {teams.map((team) => (
            <div key={team.id} className="flex flex-col">
              {/* Team Name Header */}
              <h2 className="text-center text-sm font-bold text-blue-700 tracking-widest uppercase mb-3">
                {team.name}
              </h2>

              {/* Player Table Card */}
              <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-1">
                {/* Table Header */}
                <div
                  className="grid items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: '32px 1fr 80px', background: '#F5F8FF' }}
                >
                  <span className="text-xs font-bold text-blue-900 uppercase">#</span>
                  <span className="text-xs font-bold text-blue-900 uppercase">Player</span>
                  <span className="text-xs font-bold text-blue-900 uppercase text-right pr-1">Starters</span>
                </div>

                {/* Player Rows */}
                <div>
                  {team.players.map((player, index) => (
                    <div
                      key={player.id}
                      className={`grid items-center px-4 py-2.5 ${
                        index < team.players.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                      style={{ gridTemplateColumns: '32px 1fr 80px' }}
                    >
                      {/* Jersey # */}
                      <span className="text-sm text-gray-700 font-medium">
                        {player.jerseyNumber}
                      </span>

                      {/* Player */}
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar />
                        <span className="text-sm text-blue-700 font-medium">
                          {player.firstName} {player.lastName}
                        </span>
                      </div>

                      {/* Starter Checkbox */}
                      <div className="flex justify-end pr-1">
                        <button
                          type="button"
                          onClick={() => toggleStarter(team.id, player.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            player.isStarter
                              ? 'border-blue-600 bg-white'
                              : 'border-gray-400 bg-white hover:border-blue-400'
                          }`}
                        >
                          {player.isStarter && (
                            <svg
                              viewBox="0 0 12 12"
                              fill="none"
                              className="w-3 h-3"
                              stroke="#2563EB"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Color Section */}
              <div className="flex justify-end mt-3">
                <div className="border border-gray-300 rounded-lg p-2 flex flex-col items-center gap-1 bg-white min-w-[110px]">
                  <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                    Team Color
                  </span>
                  <div
                    className="w-full rounded-md flex items-center justify-center py-1.5 px-4"
                    style={{ backgroundColor: team.color }}
                  >
                    <span className="text-white font-bold text-sm tracking-widest">00</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <div className="fixed top-6 right-8 flex items-center gap-2">
        <button
          onClick={() => navigate('/choose-sides')}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold text-sm transition-colors group"
        >
          <FiArrowRight
            size={18}
            className="group-hover:translate-x-0.5 transition-transform"
          />
          <span>Continue</span>
        </button>
      </div>
    </div>
  );
};

export default Starts;
