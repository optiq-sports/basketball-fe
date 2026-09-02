import React from 'react';
import { FiX } from 'react-icons/fi';
import { getContrastTextColor, normalizeHex } from '../../../contexts/StatisticianTeamColorsContext';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';

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

function TeamButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const normalized = normalizeHex(color) ?? color;
  const text = getContrastTextColor(normalized);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-40 items-center justify-center border-none text-sm font-bold uppercase tracking-wide shadow-sm transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ background: normalized, color: text }}
    >
      {label}
    </button>
  );
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className="flex w-full max-w-[480px] flex-col overflow-hidden border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jump-ball-modal-title"
      >
        <div className="shrink-0 border-b border-gray-200 bg-gray-900 px-4 py-3 sm:px-6">
          <h2
            id="jump-ball-modal-title"
            className="text-white"
            style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 20, letterSpacing: 1 }}
          >
            Jump Ball
          </h2>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 py-8">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Which team gains possession?</p>
          <div className="flex w-full max-w-[420px] items-center justify-center gap-4 px-8">
            <TeamButton label={homeName} color={homeColor} onClick={() => onSelect('home')} />
            <TeamButton label={awayName} color={awayColor} onClick={() => onSelect('away')} />
          </div>
        </div>

        <div className="flex h-14 shrink-0 items-center justify-center border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <FiX size={16} strokeWidth={2.2} aria-hidden />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default JumpBallModal;
