import React from 'react';
import { cl } from '../utils/cl';

const ACTIONS = ['T/O', 'JUMP-BALL', 'SUB'] as const;

export interface ActionButtonsProps {
  onTimeout?: () => void;
  onJumpBall?: () => void;
  onSub?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onTimeout, onJumpBall, onSub }) => {
  const handlers = [onTimeout, onJumpBall, onSub] as const;

  return (
    <div className="flex justify-center gap-0 font-sans">
      {ACTIONS.map((btn, i) => (
        <button
          key={btn}
          type="button"
          onClick={handlers[i]}
          className="cursor-pointer border border-gray-300 bg-white font-bold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-1"
          style={{
            padding: `${cl('4px', '0.5vh', '7px')} ${cl('10px', '1.8vw', '24px')}`,
            fontSize: cl('10px', '1vw', '13px'),
            letterSpacing: 1,
          }}
        >
          {btn}
        </button>
      ))}
    </div>
  );
};

export default ActionButtons;
