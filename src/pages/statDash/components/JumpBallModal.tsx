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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jump-ball-modal-title"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border-[3px] border-gray-500 bg-white shadow-xl">
        <div className="px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <h2
            id="jump-ball-modal-title"
            className="text-center text-sm font-bold uppercase tracking-wider sm:text-base"
            style={titleStyle}
          >
            JUMP BALL
          </h2>
          <p className="mt-2 text-center text-sm font-medium text-gray-900 sm:text-base">
            Which team gains possession?
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:justify-center sm:gap-3">
            <button
              type="button"
              onClick={() => onSelect('home')}
              className="min-h-[48px] flex-1 rounded-lg px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-[52px] sm:text-sm"
              style={{ background: homeColor }}
            >
              {homeName}
            </button>
            <button
              type="button"
              onClick={() => onSelect('away')}
              className="min-h-[48px] flex-1 rounded-lg px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-[52px] sm:text-sm"
              style={{ background: awayColor }}
            >
              {awayName}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 justify-center border-t border-gray-200 bg-sky-100/80 px-3 py-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex flex-col items-center gap-0.5 rounded px-3 py-0.5 text-gray-900 hover:bg-sky-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <FiX size={16} strokeWidth={2.2} aria-hidden />
            <span className="text-[11px] font-medium">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default JumpBallModal;
