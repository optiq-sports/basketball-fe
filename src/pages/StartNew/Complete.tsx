import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck } from 'react-icons/fi'

const Complete: React.FC = () => {
  const navigate = useNavigate()

  const handleGoToDashboard = () => {
    console.log('Navigating to competition dashboard')
    navigate('/dashboard')
  }

  const handleGoToGameSchedule = () => {
    console.log('Navigating to game schedule')
    // TODO: Replace '1' with real tournament id when backend is connected
    navigate('/tournaments/1/schedules')
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="flex flex-col items-center justify-center max-w-md w-full">
        {/* Success Icon */}
        <div className="w-32 h-32 bg-[#6AE36F] rounded-full flex items-center justify-center mb-8">
          <FiCheck className="text-white text-8xl stroke-[3]" />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-medium text-gray-800 mb-8 text-center">
          Competition setup complete
        </h1>
        
        {/* Dashboard Button */}
        <button
          onClick={handleGoToDashboard}
          className="px-12 py-3 bg-[#3559A6] hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-base"
        >
          Competition Dashboard
        </button>
        <br />

        {/* Game Schedule Button */}
        <button
          onClick={handleGoToGameSchedule}
          className="px-20 py-3 bg-[#3559A6] hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-base"
        >
          Game Schedule
        </button>

      </div>
    </div>
  )
}

export default Complete
