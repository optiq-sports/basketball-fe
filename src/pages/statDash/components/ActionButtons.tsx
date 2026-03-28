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
    <div className="flex w-full justify-center gap-1 font-sans">
      {ACTIONS.map((btn, i) => (
        <button
          key={btn}
          type="button"
          onClick={handlers[i]}
          className="cursor-pointer rounded-md border border-gray-300/90 bg-white font-bold uppercase text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-1"
          style={{
            flex: i === 1 ? '1.35 1 0%' : '1 1 0%',
            minWidth: 0,
            padding: `${cl('5px', '0.55vh', '8px')} ${cl(i === 1 ? '14px' : '8px', i === 1 ? '2.2vw' : '1.2vw', i === 1 ? '28px' : '14px')}`,
            fontSize: cl('10px', '1vw', '13px'),
            letterSpacing: 0.8,
          }}
        >
          {btn}
        </button>
      ))}
    </div>
  );
};

export default ActionButtons;
