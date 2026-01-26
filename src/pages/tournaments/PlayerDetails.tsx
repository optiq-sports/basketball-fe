import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export default function PlayerDetails() {
  const { id, matchId, playerId } = useParams<{
    id: string;
    matchId: string;
    playerId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if navigation came from Players page
  const fromPlayersPage = location.state?.from === 'players-page';

  const handleBackToMatch = () => {
    navigate(`/tournaments/${id}/match/${matchId}`);
  };

  const handleBackToPlayers = () => {
    navigate('/players-management');
  };

  const games = Array(8).fill({
    opponent: "vs TEAM, DATE",
    phase: "Tournament phase",
    pts: "8",
    fg: "3/6\n(50%)",
    twoFg: "3/6\n(50%)",
    threeFg: "3/6\n(50%)",
    ft: "3/6\n(50%)",
    reb: "8",
    oreb: "8",
    dreb: "8",
    ast: "8",
    stl: "8",
    blk: "8",
    pf: "8",
    to: "8",
    plusMinus: "8",
    eff: "8",
  });

  return (
    <div className="min-h-screen bg-[#FCFEFF] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Competition Name
            </h1>
            <p className="text-sm text-gray-600 mt-1">Tournament Round</p>
          </div>
        </div>

        {/* Player Profile */}
        <div
          className="rounded-2xl shadow-sm overflow-hidden mb-4 bg-white relative"
          style={{
            backgroundImage: "url('/player-bg.png')",
            backgroundPosition: "right center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "600px 300px",
          }}
        >
          <div className="p-8 flex justify-between items-start">
            {/* Player Info */}
            <div className="flex-1">
              <span className="text-sm text-gray-500">#23</span>
              <h2 className="text-4xl font-bold text-blue-900 mt-2">Name</h2>
              <h2 className="text-4xl font-bold text-blue-900">Surname</h2>
            </div>

            {/* Player Image */}
            <div className="relative">
              <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
                <img
                  src="/dplayer.png"
                  alt="Player"
                  className="relative z-10 w-full h-full object-cover rounded-2xl"
                />
                <div className="absolute top-4 right-4 w-8 h-6 rounded-sm flex items-center justify-center z-20">
                  <img src="/flag.png" alt="flag" />
                </div>
              </div>
            </div>
          </div>

          {/* Player Info Grid */}
          <div className="p-8 relative" style={{ background: "#EEF3FF" }}>
            <div className="grid grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-sm text-gray-600">Date of birth</p>
                <p className="text-lg font-semibold text-blue-900">
                  12 March 1998
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Height</p>
                <p className="text-lg font-semibold text-blue-900">198 cm</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Club</p>
                <p className="text-lg font-semibold text-blue-900">Team Name</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-blue-900">Forward</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Summary Cards */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="grid grid-cols-6 gap-6">
            {[
              { label: "Points", value: 12 },
              { label: "Rebounds", value: 9 },
              { label: "Assists", value: 5 },
              { label: "FG%", value: "52%" },
              { label: "Steals", value: 3 },
              { label: "Blocks", value: 2 },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-[#21409A] rounded-xl p-6 text-center text-white"
              >
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-sm text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* New Stats Table */}
        <div className="w-full bg-gray-50 p-6 rounded-2xl shadow-sm">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">
                      Games(s)
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      PTS
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      FG
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      2PT FG
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      3PT FG
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      FT
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      REB
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      OREB
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      DREB
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      AST
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      STL
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      BLK
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      PF
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      TO
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      +/-
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">
                      EFF
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-blue-700">
                          {game.opponent}
                        </div>
                        <div className="text-xs text-gray-600">
                          {game.phase}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">
                        {game.pts}
                      </td>
                      {["fg", "twoFg", "threeFg", "ft"].map((key) => (
                        <td
                          key={key}
                          className="px-4 py-4 text-center text-sm text-gray-800"
                        >
                          <div>3/6</div>
                          <div className="text-xs text-gray-600">(50%)</div>
                        </td>
                      ))}
                      {[
                        "reb",
                        "oreb",
                        "dreb",
                        "ast",
                        "stl",
                        "blk",
                        "pf",
                        "to",
                        "plusMinus",
                        "eff",
                      ].map((key) => (
                        <td
                          key={key}
                          className="px-4 py-4 text-center text-sm text-gray-800"
                        >
                          {game[key as keyof typeof game]}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Cumulative Row */}
                  <tr className="bg-blue-50 border-b border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-blue-900">
                      Cumulative
                    </td>
                    {Array(15)
                      .fill(0)
                      .map((_, i) => (
                        <td
                          key={i}
                          className="px-4 py-4 text-center text-sm font-medium text-gray-800"
                        >
                          8
                        </td>
                      ))}
                  </tr>

                  {/* Average Row */}
                  <tr className="bg-blue-50">
                    <td className="px-4 py-4 text-sm font-semibold text-blue-900">
                      Average
                    </td>
                    {Array(15)
                      .fill(0)
                      .map((_, i) => (
                        <td
                          key={i}
                          className="px-4 py-4 text-center text-sm font-medium text-gray-800"
                        >
                          8
                        </td>
                      ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Back Button */}
        {!fromPlayersPage && (
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToMatch}
              className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
            >
              Back to Match
            </button>
          </div>
        )}
        {fromPlayersPage && (
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToPlayers}
              className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
            >
              Back to Players
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
