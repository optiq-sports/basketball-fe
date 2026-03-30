import React from 'react';
import { FiX } from 'react-icons/fi';
import { STAT_DASH } from '../statDashTheme';

export type JumpBallChoice = 'home' | 'away';

export interface JumpBallModalProps {
  open: boolean;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  onSelect: (choice: JumpBallChoice) => void;
  onCancel: () => void;
}

const JumpBallModal: React.FC<JumpBallModalProps> = ({
  open,
  homeName,
  awayName,
  homeColor,
  awayColor,
  onSelect,
  onCancel,
}) => {
  if (!open) return null;

  const titleStyle = { color: STAT_DASH.accentBlue };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-[3px] border-gray-500 bg-white shadow-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jump-ball-modal-title"
    >
      <div className="flex-none px-4 pt-3 sm:px-6">
        <h2
          id="jump-ball-modal-title"
          className="text-center text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-[12px]"
          style={titleStyle}
        >
          JUMP BALL
        </h2>
        <p className="mt-[14px] text-center text-[11px] font-medium text-gray-900 sm:text-[12px]">
          Which team gains possession?
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[420px] px-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onSelect('home')}
            className="h-[48px] w-[140px] rounded-[4px] text-[14px] font-bold uppercase tracking-wide text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: homeColor }}
          >
            {homeName}
          </button>
          <button
            type="button"
            onClick={() => onSelect('away')}
            className="h-[48px] w-[140px] rounded-[4px] text-[14px] font-bold uppercase tracking-wide text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: awayColor }}
          >
            {awayName}
          </button>
        </div>
      </div>

      <div className="flex-none border-t border-gray-200 bg-sky-100/80 h-[64px] flex items-center justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-col items-center gap-[2px] px-0 py-[6px] text-gray-900 hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <FiX size={18} strokeWidth={2.2} aria-hidden />
          <span className="text-[12px] font-medium">Cancel</span>
        </button>
      </div>
    </div>
  );
};

export default JumpBallModal;
