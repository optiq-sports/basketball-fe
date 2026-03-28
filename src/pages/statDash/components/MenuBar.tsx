import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from 'react-icons/vsc';
import { cl } from '../utils/cl';

const MENU = ['FILE', 'GAME', 'REPORTS', 'SETTINGS', 'HELP'] as const;

/** Reference: solid black bar, thin top rule, white semibold caps, window controls right */
const menuBtnClass =
  'cursor-pointer bg-transparent p-0 font-sans text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

const MenuBar: React.FC = () => {
  const navigate = useNavigate();
  const labelSize = { fontSize: cl('11px', '1.1vw', '14px') };

  return (
    <header
      className="flex shrink-0 select-none items-center justify-between border-t border-[#2d2d2d] bg-black px-4 text-white sm:px-5"
      style={{ height: 36, minHeight: 36 }}
    >
      <div className="flex min-w-0 items-center gap-[clamp(12px,2.2vw,28px)]">
        <nav className="flex items-center gap-[clamp(12px,2.2vw,28px)]" aria-label="Main menu">
          {MENU.map((m) => (
            <button
              key={m}
              type="button"
              className={`${menuBtnClass} font-semibold uppercase tracking-wide`}
              style={labelSize}
            >
              {m}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => navigate('/match-key')}
          className={`${menuBtnClass} shrink-0 font-semibold uppercase tracking-wide`}
          style={labelSize}
        >
          EXIT
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-4 sm:gap-5">
        <button type="button" className="flex text-white hover:opacity-80" aria-label="Minimize">
          <VscChromeMinimize size={14} strokeWidth={0.5} />
        </button>
        <button type="button" className="flex text-white hover:opacity-80" aria-label="Maximize">
          <VscChromeMaximize size={14} strokeWidth={0.5} />
        </button>
        <button type="button" className="flex text-white hover:opacity-80" aria-label="Close">
          <VscChromeClose size={14} strokeWidth={0.5} />
        </button>
      </div>
    </header>
  );
};

export default MenuBar;
