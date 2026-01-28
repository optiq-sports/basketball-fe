import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaCalendar } from 'react-icons/fa';

const TournamentsListing: React.FC = () => {
  const navigate = useNavigate();

  const tournaments = [
    {
      id: 1,
      title: "KCBL Club championship",
      location: "Kaduna, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    },
    {
      id: 2,
      title: "KCBL Club championship",
      location: "Lagos, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    },
    {
      id: 3,
      title: "KCBL Club championship",
      location: "Abuja, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    },
    {
      id: 4,
      title: "KCBL Club championship",
      location: "Kano, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    },
    {
      id: 5,
      title: "KCBL Club championship",
      location: "Port Harcourt, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    },
    {
      id: 6,
      title: "KCBL Club championship",
      location: "Ibadan, NG",
      date: "TBA",
      registrationFee: "N20,000",
      isRegistrationOpen: true
    }
  ];

  const handleTournamentClick = (tournamentId: number) => {
    navigate(`/tournaments/${tournamentId}`);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState<string>('All');

  // Derive seasons from title or use simple mock seasons
  const seasons = useMemo(() => {
    // In a real app, tournaments would carry an explicit season field
    const baseSeasons = ['2023-2024', '2024-2025'];
    return baseSeasons;
  }, []);

  const filteredTournaments = useMemo(() => {
    let filtered = tournaments;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q)
      );
    }

    // For now, seasonFilter is a simple mock filter; when real seasons exist,
    // this can be wired to a tournament.season field.
    // We keep it in place so the UI matches other pages.

    return filtered;
  }, [searchQuery, seasonFilter, tournaments]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-normal text-gray-800">Tournaments</h1>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {/* Search */}
          <div className="relative" style={{ width: '260px', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search tournaments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Season Filter */}
          <div className="relative">
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer text-sm min-w-[160px]"
            >
              <option value="All">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tournaments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <div
              key={tournament.id}
              onClick={() => handleTournamentClick(tournament.id)}
              style={{
                width: '310px',
                height: '413px',
                opacity: 1,
                borderRadius: '16px',
                borderWidth: '1px',
                background: '#FCFEFF',
                border: '1px solid #A9A9A91A'
              }}
              className="hover:shadow-md transition-shadow duration-200 cursor-pointer overflow-hidden"
            >
               {/* Tournament Graphic */}
               <div className="relative h-79 overflow-hidden">
                 {/* Background Flyer Image */}
                 <img 
                   src="/flyer.png" 
                   alt="Tournament Flyer" 
                   style={{
                     width: '286px',
                     height: '300px',
                     top: '14px',
                     left: '12px',
                     opacity: 1,
                     borderRadius: '6px'
                   }}
                   className="absolute object-cover"
                 />
               </div>

               {/* Tournament Details */}
               <div className="p-4">
                 <h3 className="text-lg font-semibold text-gray-800 mb-3">{tournament.title}</h3>
                
                <div className="flex items-center justify-start gap-4">
                  {/* Location */}
                  <div className="flex items-center text-gray-600">
                    <FaMapMarkerAlt className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm">{tournament.location}</span>
                  </div>
                  
                  {/* Date */}
                  <div className="flex items-center text-gray-600">
                    <FaCalendar className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm">{tournament.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentsListing;
