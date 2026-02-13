import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronUp, FiChevronDown, FiPlus, FiUpload, FiUser } from 'react-icons/fi';
import FileUploadBox from './FileUploadBox';
import PlayerImageUploadBox from './PlayerImageUploadBox';

const basketballPositions = ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'];

const countryOptions = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Nigeria',
  'France', 'Germany', 'Spain', 'Philippines', 'Brazil'
];

interface Player {
  id: number;
  no: string;
  name: string;
  country: string;
  height: string;
  position: string;
  dob: string;
  captain: boolean;
  imageUrl?: string;
}

interface TeamPlayers {
  id: number;
  teamName: string;
  isExpanded: boolean;
  players: Player[];
}


// 🏀 Players Component
const Players: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamPlayers[]>([
    {
      id: 1,
      teamName: 'Team Name',
      isExpanded: true,
      players: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        no: '',
        name: '',
        country: '',
        height: '',
        position: '',
        dob: '',
        captain: i === 0,
        imageUrl: '',
      })),
    },
  ]);

  const [activeTeamId, setActiveTeamId] = useState<number | null>(null); // For modal state
  const [activeImageTarget, setActiveImageTarget] = useState<{ teamId: number; playerId: number } | null>(null);

  const addTeam = () => {
    const newTeam: TeamPlayers = {
      id: teams.length + 1,
      teamName: 'Team Name',
      isExpanded: false,
      players: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        no: '',
        name: '',
        country: '',
        height: '',
        position: '',
        dob: '',
        captain: false,
      })),
    };
    setTeams([...teams, newTeam]);
  };

  const addPlayer = (teamId: number) => {
    setTeams(teams.map(team =>
      team.id === teamId
        ? {
            ...team,
            players: [
              ...team.players,
              { id: team.players.length + 1, no: '', name: '', country: '', height: '', position: '', dob: '', captain: false },
            ],
          }
        : team
    ));
  };

  const toggleTeam = (id: number) => {
    setTeams(teams.map(team => (team.id === id ? { ...team, isExpanded: !team.isExpanded } : team)));
  };

  const updatePlayer = (teamId: number, playerId: number, field: keyof Player, value: any) => {
    setTeams(teams.map(team =>
      team.id === teamId
        ? {
            ...team,
            players: team.players.map(player =>
              player.id === playerId ? { ...player, [field]: value } : player
            ),
          }
        : team
    ));
  };

  const toggleCaptain = (teamId: number, playerId: number) => {
    setTeams(teams.map(team =>
      team.id === teamId
        ? {
            ...team,
            players: team.players.map(player => ({
              ...player,
              captain: player.id === playerId,
            })),
          }
        : team
    ));
  };

  const handleUploadList = (teamId: number) => {
    setActiveTeamId(teamId); // open modal for this team
  };

  const handlePrevious = () => navigate('/teams');
  const handleDiscard = () => navigate('/teams');
  const handleSaveNext = () => navigate('/team-overview');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800 mb-3">Players</h1>
              <div className="flex gap-2">
                <div className="w-24 h-1 bg-green-500"></div>
                <div className="w-16 h-1 bg-green-500"></div>
                <div className="w-20 h-1 bg-green-500"></div>
              </div>
            </div>
            <button
              onClick={addTeam}
              className="flex items-center gap-2 px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <FiPlus className="text-lg" />
              Add Team
            </button>
          </div>
        </div>

        {/* Teams */}
        <div className="space-y-4 mb-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Team Header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors bg-gray-100"
                onClick={() => toggleTeam(team.id)}
              >
                <h3 className="text-base font-medium text-gray-800">
                  Team {team.id} - {team.teamName}
                </h3>
                {team.isExpanded ? (
                  <FiChevronUp className="text-gray-600 text-xl" />
                ) : (
                  <FiChevronDown className="text-gray-600 text-xl" />
                )}
              </div>

              {/* Expanded Players */}
              {team.isExpanded && (
                <div className="px-6 pb-6 pt-4">

                  {/* Table Header */}
                  <div className="grid grid-cols-13 gap-3 mb-3 pb-2 border-b border-gray-200">
                    <div className="col-span-1 text-sm font-medium text-gray-600 text-center">NO</div>
                    <div className="col-span-3 text-sm font-medium text-gray-600 text-center">Player Name</div>
                    <div className="col-span-2 text-sm font-medium text-gray-600 text-center">Country</div>
                    <div className="col-span-2 text-sm font-medium text-gray-600 text-center">Height</div>
                    <div className="col-span-2 text-sm font-medium text-gray-600 text-center">Position</div>
                    <div className="col-span-2 text-sm font-medium text-gray-600 text-center">DOB</div>
                    <div className="col-span-1 text-sm font-medium text-gray-600 text-center">Players Img</div>
                  </div>

                  {/* Player Rows */}
                  <div className="space-y-3">
                    {team.players.map((player) => (
                      <div key={player.id} className="grid grid-cols-13 gap-3 items-center">
                        <div className="col-span-1">
                          <input
                            type="text"
                            placeholder="NO."
                            value={player.no}
                            onChange={(e) => updatePlayer(team.id, player.id, 'no', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            placeholder="Name Surname"
                            value={player.name}
                            onChange={(e) => updatePlayer(team.id, player.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={player.country}
                            onChange={(e) => updatePlayer(team.id, player.id, 'country', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-center"
                          >
                            <option value="">Country</option>
                            {countryOptions.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Height"
                            value={player.height}
                            onChange={(e) => updatePlayer(team.id, player.id, 'height', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={player.position}
                            onChange={(e) => updatePlayer(team.id, player.id, 'position', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-center"
                          >
                            <option value="">Position</option>
                            {basketballPositions.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="date"
                            value={player.dob}
                            onChange={(e) => updatePlayer(team.id, player.id, 'dob', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => setActiveImageTarget({ teamId: team.id, playerId: player.id })}
                            className="w-10 h-10 rounded-full overflow-hidden border border-gray-300 bg-gray-100 flex items-center justify-center"
                            title="Upload player image"
                          >
                            {player.imageUrl ? (
                              <img src={player.imageUrl} alt={player.name || `Player ${player.id}`} className="w-full h-full object-cover cursor-pointer" />
                            ) : (
                              <FiUser className="text-gray-400 text-lg cursor-pointer" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Team Captain Dropdown */}
                  <div className="mt-6 flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Team Captain:</label>
                    <select
                      className="w-64 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                      value={team.players.find(p => p.captain)?.id || ''}
                      onChange={(e) => {
                        const selectedId = Number(e.target.value);
                        setTeams(teams.map(t => {
                          if (t.id === team.id) {
                            return {
                              ...t,
                              players: t.players.map(p => ({
                                ...p,
                                captain: p.id === selectedId,
                              })),
                            };
                          }
                          return t;
                        }));
                      }}
                    >
                      <option value="">Name Surname</option>
                      {team.players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name || `Player ${player.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bottom Action Row: Upload List + Add Player */}
                  <div className="mt-4 flex justify-start gap-3">
                    <button
                      onClick={() => handleUploadList(team.id)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <FiUpload className="text-lg" />
                      Upload List
                    </button>
                    <button
                      onClick={() => addPlayer(team.id)}
                      className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                    >
                      <FiPlus className="text-lg" />
                      Add Player
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between">
          <div className="flex gap-3">
            <button onClick={handlePrevious} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Previous
            </button>
            <button onClick={handleDiscard} className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Discard
            </button>
          </div>
          <button onClick={handleSaveNext} className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Save & Next
          </button>
        </div>
      </div>

      {/* Modal - File Upload (teamId empty: StartNew uses local teams; FileUploadBox shows guidance to use Players Management) */}
      {activeTeamId !== null && (
        <FileUploadBox teamId="" onClose={() => setActiveTeamId(null)} />
      )}
      {activeImageTarget && (
        <PlayerImageUploadBox
          onClose={() => setActiveImageTarget(null)}
          onUploaded={(url) => {
            const { teamId, playerId } = activeImageTarget;
            setTeams(teams.map(t => (
              t.id === teamId
                ? {
                    ...t,
                    players: t.players.map(p => (
                      p.id === playerId ? { ...p, imageUrl: url } : p
                    )),
                  }
                : t
            )));
            setActiveImageTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default Players;
