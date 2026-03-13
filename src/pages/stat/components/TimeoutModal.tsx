import React from 'react';
import { FiX } from 'react-icons/fi';

interface Props {
  team1Color: string;
  team2Color: string;
  team1Name: string;
  team2Name: string;
  onSelect: (who: 'team1' | 'team2' | 'officials') => void;
  onCancel: () => void;
}

const TimeoutModal: React.FC<Props> = ({
  team1Color,
  team2Color,
  team1Name,
  team2Name,
  onSelect,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-[950] bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
        {/* Title */}
        <div className="pt-8 pb-4 flex flex-col items-center gap-1">
          <h2 className="text-blue-600 font-bold text-xl tracking-widest uppercase">
            Timeout
          </h2>
          <p className="text-gray-700 text-base mt-1">Who Took Time Out?</p>
        </div>

        {/* Choices */}
        <div className="flex items-center justify-center gap-6 px-10 py-8">
          {/* Team 1 */}
          <button
            onClick={() => onSelect('team1')}
            className="px-8 py-4 rounded text-white font-bold text-base tracking-widest transition-all hover:opacity-90 active:scale-95 min-w-[120px]"
            style={{ backgroundColor: team1Color }}
          >
            {team1Name}
          </button>

          {/* Officials */}
          <button
            onClick={() => onSelect('officials')}
            className="px-8 py-4 rounded border-2 border-gray-800 text-gray-800 font-bold text-base tracking-widest bg-white transition-all hover:bg-gray-50 active:scale-95 min-w-[120px]"
          >
            OFFICIALS
          </button>

          {/* Team 2 */}
          <button
            onClick={() => onSelect('team2')}
            className="px-8 py-4 rounded text-white font-bold text-base tracking-widest transition-all hover:opacity-90 active:scale-95 min-w-[120px]"
            style={{ backgroundColor: team2Color }}
          >
            {team2Name}
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 py-3 flex flex-col items-center">
          <button
            onClick={onCancel}
            className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-red-500 transition-colors"
          >
            <FiX size={16} />
            <span className="text-xs font-semibold">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeoutModal;
