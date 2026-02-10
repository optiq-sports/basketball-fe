import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateTournament } from '../../api/hooks';

interface Official {
  id: number;
  name: string;
  role: string;
  shirtNumber: string;
}

const countriesData: Record<string, string[]> = {
  'United States': ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia'],
  'Nigeria': ['Lagos', 'Kano', 'Rivers', 'Kaduna', 'Oyo', 'Abuja'],
};

const divisionOptions = [
  'Premier Division',
  'Division 1',
  'Division 2',
  'Division 3',
  'Junior Division',
];

const StartNew: React.FC = () => {
  const navigate = useNavigate();
  const createTournament = useCreateTournament();
  const [competitionName, setCompetitionName] = useState('');
  const [competitionShortName, setCompetitionShortName] = useState('');
  const [division, setDivision] = useState('');
  const [numberOfGames, setNumberOfGames] = useState('28');
  const [numberOfQuarters, setNumberOfQuarters] = useState('4');
  const [quarterDuration, setQuarterDuration] = useState('10 Mins');
  const [overtimeDuration, setOvertimeDuration] = useState('10 Mins');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [court, setCourt] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [flyer, setFlyer] = useState<File | null>(null);

  const availableStates = country ? countriesData[country] || [] : [];

  const [officials, setOfficials] = useState<Official[]>([
    { id: 1, name: '', role: 'Crew Chief', shirtNumber: '' },
    { id: 2, name: '', role: 'Umpire', shirtNumber: '' },
    { id: 3, name: '', role: 'Umpire', shirtNumber: '' },
    { id: 4, name: '', role: 'Commissioner', shirtNumber: '' },
  ]);

  const handleOfficialChange = (id: number, field: keyof Official, value: string) => {
    setOfficials(officials.map((official) =>
      official.id === id ? { ...official, [field]: value } : official
    ));
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setState('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFlyer(e.target.files[0]);
    }
  };

  const handleDiscard = () => {
    navigate('/dashboard');
  };

  const handleSaveNext = () => {
    if (!competitionName.trim() || !court.trim() || !date || !time) {
      alert('Please fill in Competition name, Venue, Date and Time.');
      return;
    }
    const numGames = parseInt(numberOfGames, 10) || 14;
    const numQuarters = parseInt(numberOfQuarters, 10) || 4;
    const quarterMins = parseInt(quarterDuration.replace(/\D/g, ''), 10) || 10;
    const overtimeMins = parseInt(overtimeDuration.replace(/\D/g, ''), 10) || 5;

    const startDateStr = `${date}T${time}:00`;
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7); // default 1 week

    const payload = {
      name: competitionName.trim(),
      division: division || 'PREMIER',
      numberOfGames: numGames,
      numberOfQuarters: numQuarters,
      quarterDuration: quarterMins,
      overtimeDuration: overtimeMins,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      venue: court.trim(),
      crewChief: officials[0]?.name || undefined,
      umpire1: officials[1]?.name || undefined,
      umpire2: officials[2]?.name || undefined,
      commissioner: officials[3]?.name || undefined,
    };

    createTournament.mutate(payload, {
      onSuccess: (data) => {
        navigate(`/tournaments/${data.id}`);
      },
      onError: (err) => alert(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Competition Setup</h1>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-3 space-y-6">
              
            {/* Competition Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition</label>
              <input
                type="text"
                placeholder="Name Here"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              {/* Competition Short Name + Division (side by side) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Competition Short Name</label>
                  <input
                    type="text"
                    placeholder="Short Name"
                    value={competitionShortName}
                    onChange={(e) => setCompetitionShortName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Division <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Select Division</option>
                    {divisionOptions.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Number of Games & Quarters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Games</label>
                <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Enter number of games"
                  value={numberOfGames}
                  onChange={(e) => setNumberOfGames(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Quarters</label>
                  <select
                  value={numberOfQuarters}
                  onChange={(e) => setNumberOfQuarters(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="2">2</option>
                    <option value="4">4</option>
                    <option value="6">6</option>
                  </select>
              </div>
            </div>

              {/* Quarter Duration & Overtime Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quarter Duration</label>
                <input
                  type="text"
                  value={quarterDuration}
                  onChange={(e) => setQuarterDuration(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Duration</label>
                <input
                  type="text"
                  value={overtimeDuration}
                  onChange={(e) => setOvertimeDuration(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>

            {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
            <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                    type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
              </div>
            </div>

            {/* Venue */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
              <input
                type="text"
                placeholder="Court"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 mb-3"
              />
              <div className="grid grid-cols-2 gap-3">
                  <select
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Select Country</option>
                    {Object.keys(countriesData).map((countryName) => (
                      <option key={countryName} value={countryName}>
                        {countryName}
                      </option>
                    ))}
                  </select>
                  <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                    disabled={!country}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">Select State</option>
                    {availableStates.map((stateName) => (
                      <option key={stateName} value={stateName}>
                        {stateName}
                      </option>
                    ))}
                  </select>
              </div>
            </div>

            {/* Officials */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Officials</label>
              <div className="space-y-3">
                {officials.map((official, index) => (
                  <div key={official.id} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-1 text-sm text-gray-600">{index + 1}.</div>
                    <input
                      type="text"
                      placeholder="Name Surname"
                      value={official.name}
                      onChange={(e) => handleOfficialChange(official.id, 'name', e.target.value)}
                        className="col-span-6 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                    <div className="col-span-3">
                      <select
                        value={official.role}
                        onChange={(e) => handleOfficialChange(official.id, 'role', e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="Crew Chief">Crew Chief</option>
                        <option value="Umpire">Umpire</option>
                        <option value="Commissioner">Commissioner</option>
                        <option value="Referee">Referee</option>
                      </select>
                    </div>
                    <input
                      type="text"
                        placeholder="Shirt No."
                      value={official.shirtNumber}
                      onChange={(e) => handleOfficialChange(official.id, 'shirtNumber', e.target.value)}
                        className="col-span-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Upload Flyer */}
          <div className="lg:col-span-1">
              <label
                htmlFor="flyer-upload"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-3">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Upload Competition Flyer</p>
                </div>
                <input
                  id="flyer-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </label>
              {flyer && (
                <p className="mt-2 text-xs text-gray-600 text-center">
                  Selected: {flyer.name}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={handleDiscard}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Discard
            </button>
            <button
              onClick={handleSaveNext}
              className="px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save & Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartNew;
