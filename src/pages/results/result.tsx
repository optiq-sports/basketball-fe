import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFilter, FiChevronDown, FiSearch } from 'react-icons/fi';
import { useMatches, useTeams } from '../../api/hooks';

interface MatchResult {
  id: string;
  teamA: string;
  teamAScore: number;
  teamAColor: string;
  teamB: string;
  teamBScore: number;
  teamBColor: string;
  venue: string;
  datetime: string;
  date: string;
}

const Results: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const matchesQuery = useMatches(undefined, 'COMPLETED');
  const teamsQuery = useTeams();
  const teamMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    (teamsQuery.data ?? []).forEach((team) =>
      map.set(team.id, { name: team.name, color: team.color ?? '' }),
    );
    return map;
  }, [teamsQuery.data]);
  const results: MatchResult[] = useMemo(() => {
    return (matchesQuery.data ?? []).map((match) => {
      const dateObj = new Date(match.scheduledDate);
      return {
        id: match.id,
        teamA: teamMap.get(match.homeTeamId)?.name ?? 'TEAM A',
        teamAScore: match.totalHome ?? 0,
        teamAColor: teamMap.get(match.homeTeamId)?.color ? 'yellow' : 'yellow',
        teamB: teamMap.get(match.awayTeamId)?.name ?? 'TEAM B',
        teamBScore: match.totalAway ?? 0,
        teamBColor: teamMap.get(match.awayTeamId)?.color ? 'blue' : 'blue',
        venue: match.venue ?? 'Match Venue',
        datetime: dateObj.toLocaleString(),
        date: dateObj.toLocaleDateString(),
      };
    });
  }, [matchesQuery.data, teamMap]);

  // Get unique dates for the dropdown and sort them (most recent first)
  const uniqueDatesSet = Array.from(new Set(results.map(r => r.date)));
  const sortedDates = uniqueDatesSet.sort((a, b) => {
    // Parse dates for comparison (assuming format: "DD Month YYYY")
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
  });
  const uniqueDates = ['All', ...sortedDates];

  // Filter results by selected date and search query
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Filter by date
    if (selectedDate !== 'All') {
      filtered = filtered.filter(result => result.date === selectedDate);
    }

    // Filter by search query (search in team names, venue, or datetime)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(result =>
        result.teamA.toLowerCase().includes(query) ||
        result.teamB.toLowerCase().includes(query) ||
        result.venue.toLowerCase().includes(query) ||
        result.datetime.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selectedDate, searchQuery, results]);

  // Group filtered results by date and sort by date (most recent first)
  const groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.date]) {
      acc[result.date] = [];
    }
    acc[result.date].push(result);
    return acc;
  }, {} as Record<string, MatchResult[]>);

  // Sort grouped results by date (most recent first)
  const sortedGroupedResults = Object.entries(groupedResults).sort(([dateA], [dateB]) => {
    const parsedDateA = new Date(dateA);
    const parsedDateB = new Date(dateB);
    return parsedDateB.getTime() - parsedDateA.getTime();
  });

  // Flatten grouped results for pagination
  const allMatches = sortedGroupedResults.flatMap(([date, matches]) =>
    matches.map(match => ({ ...match, groupDate: date }))
  );

  // Calculate pagination
  const totalPages = Math.ceil(allMatches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMatches = allMatches.slice(startIndex, endIndex);

  // Group paginated matches by date for display
  const paginatedGroupedResults = paginatedMatches.reduce((acc, match) => {
    if (!acc[match.groupDate]) {
      acc[match.groupDate] = [];
    }
    acc[match.groupDate].push(match);
    return acc;
  }, {} as Record<string, (MatchResult & { groupDate: string })[]>);

  const sortedPaginatedResults = Object.entries(paginatedGroupedResults).sort(([dateA], [dateB]) => {
    const parsedDateA = new Date(dateA);
    const parsedDateB = new Date(dateB);
    return parsedDateB.getTime() - parsedDateA.getTime();
  });

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchQuery]);

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-800 mb-6">Results</h1>
          
          {/* Search and Filter Bar */}
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by team, venue, or date"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Sort Dropdown */}
            <div className="relative">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
              >
                {uniqueDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-8 mb-8">
          {(matchesQuery.isPending || teamsQuery.isPending) && (
            <div className="text-sm text-gray-600">Loading completed games...</div>
          )}
          {(matchesQuery.error instanceof Error || teamsQuery.error instanceof Error) && (
            <div className="text-sm text-red-600">
              {matchesQuery.error instanceof Error ? matchesQuery.error.message : teamsQuery.error instanceof Error ? teamsQuery.error.message : 'Failed to load results'}
            </div>
          )}
          {sortedPaginatedResults.length > 0 ? (
            sortedPaginatedResults.map(([date, matches], groupIndex) => (
              <div key={groupIndex}>
                {/* Date Header */}
                <h2 className="text-sm font-semibold text-gray-800 mb-4">{date}</h2>
                
                {/* Matches for this date */}
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="bg-gray-50 rounded-lg p-5 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/tournaments/1/match/${match.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        {/* Left side - Teams and Scores */}
                        <div className="space-y-3">
                          {/* Team A */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded">
                              <img
                                src={match.teamAColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                                alt="Basketball"
                                className="w-7 h-7 object-contain"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-20">{match.teamA}</span>
                            <span className="text-sm font-semibold text-gray-800">- {match.teamAScore}</span>
                          </div>

                          {/* Team B */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded">
                              <img
                                src={match.teamBColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                                alt="Basketball"
                                className="w-7 h-7 object-contain"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-20">{match.teamB}</span>
                            <span className="text-sm font-semibold text-gray-800">- {match.teamBScore}</span>
                          </div>
                        </div>

                        {/* Right side - Venue and DateTime */}
                        <div className="text-right text-xs text-gray-500">
                          <p>{match.venue}</p>
                          <p>{match.datetime}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No results found</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and pages around current
              const showPage = 
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1);

              if (!showPage) {
                // Show ellipsis
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                return null;
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-900 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Results;
