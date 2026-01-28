import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GiBasketballBall } from 'react-icons/gi'
import { FiTrash } from 'react-icons/fi'

interface TeamOverview {
  id: number;
  name: string;
  logo: string | null;
  coachName: string;
  playersRegistered: number;
}

const TeamOverview: React.FC = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamOverview[]>([
    {
      id: 1,
      name: 'Team Name',
      logo: null,
      coachName: 'Coach Name',
      playersRegistered: 12,
    },
    {
      id: 2,
      name: 'Team Name',
      logo: null,
      coachName: 'Coach Name',
      playersRegistered: 12,
    },
    {
      id: 3,
      name: 'Team Name',
      logo: null,
      coachName: 'Coach Name',
      playersRegistered: 12,
    },
    {
      id: 4,
      name: 'Team Name',
      logo: null,
      coachName: 'Coach Name',
      playersRegistered: 12,
    },
    {
      id: 5,
      name: 'Team Name',
      logo: null,
      coachName: 'Coach Name',
      playersRegistered: 12,
    },
  ]);

  const handleDeleteTeam = (teamId: number) => {
    setTeams(teams.filter(team => team.id !== teamId));
    console.log('Team deleted:', teamId);
  };

  const handlePrevious = () => {
    navigate('/players');
  };

  const handleCancel = () => {
    console.log('Form cancelled');
    navigate('/players');
  };

  const handleSaveNext = () => {
    console.log('Teams overview confirmed');
    navigate('/complete');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 mb-3">Teams Overview</h1>
          <div className="flex gap-2">
            <div className="w-20 h-1 bg-green-500"></div>
            <div className="w-20 h-1 bg-green-500"></div>
            <div className="w-20 h-1 bg-green-500"></div>
            <div className="w-20 h-1 bg-green-500"></div>
            <div className="w-20 h-1 bg-gray-300"></div>
          </div>
        </div>

        {/* Teams List */}
        <div className="space-y-4 mb-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-gray-50 rounded-lg shadow-sm p-6 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              {/* Left Section - Logo and Team Name */}
              <div className="flex items-center gap-4">
                {/* Team Logo */}
                <div className="w-12 h-12 bg-orange-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <GiBasketballBall className="text-white text-2xl" />
                  )}
                </div>

                {/* Team Name */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800">
                    Team {team.id} - {team.name}
                  </h3>
                </div>
              </div>

              {/* Right Section - Coach, Players, and Delete */}
              <div className="flex items-center gap-12">
                {/* Coach Info */}
                <div className="text-sm text-gray-500">
                  <span className="font-normal">Coach - </span>
                  <span className="text-gray-400">{team.coachName}</span>
                </div>

                {/* Players Registered */}
                <div className="text-sm text-gray-500">
                  <span className="font-normal">Players Registered - </span>
                  <span className="text-gray-400">{team.playersRegistered}</span>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete team"
                >
                  <FiTrash className="text-lg" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-3">
          <div className="flex gap-3">
            <button
              onClick={handlePrevious}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Previous
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
          <button
            onClick={handleSaveNext}
            className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save & Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamOverview;
