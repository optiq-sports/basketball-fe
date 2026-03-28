import React from 'react';
import { useNavigate } from 'react-router-dom';
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from 'react-icons/vsc';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

const MENU = ['FILE', 'GAME', 'REPORTS', 'SETTINGS', 'HELP'] as const;

const MenuBar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header
      className="flex shrink-0 select-none items-center gap-[clamp(10px,2vw,26px)] border-b-2 bg-[#1c1c1c] px-4 text-white"
      style={{ height: 32, borderBottomColor: STAT_DASH.accentBlue }}
    >
      <nav className="flex items-center gap-[clamp(10px,2vw,26px)]" aria-label="Main menu">
        {MENU.map((m) => (
          <button
            key={m}
            type="button"
            className="cursor-pointer bg-transparent p-0 font-sans font-normal text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ fontSize: cl('11px', '1.1vw', '14px') }}
          >
            {m}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => navigate('/match-key')}
        className="ml-2 shrink-0 cursor-pointer bg-transparent p-0 font-sans font-normal text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ fontSize: cl('11px', '1.1vw', '14px') }}
      >
        EXIT
      </button>
      <div className="ml-auto flex items-center gap-[18px]">
        <button type="button" className="flex p-0.5 text-white hover:opacity-80" aria-label="Minimize">
          <VscChromeMinimize size={14} />
        </button>
        <button type="button" className="flex p-0.5 text-white hover:opacity-80" aria-label="Maximize">
          <VscChromeMaximize size={14} />
        </button>
        <button type="button" className="flex p-0.5 text-white hover:opacity-80" aria-label="Close">
          <VscChromeClose size={14} />
        </button>
      </div>
    </header>
  );
};

export default MenuBar;
