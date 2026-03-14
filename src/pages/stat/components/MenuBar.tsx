import React, { useState, useRef, useEffect } from 'react';

const MENUS: { label: string; items: string[] }[] = [
  {
    label: 'FILE',
    items: ['Close Game', 'Exit'],
  },
  {
    label: 'GAME',
    items: ['Switch Team Side', 'Setup Quarters', 'Finish Match', 'Export Game'],
  },
  {
    label: 'REPORTS',
    items: ['Box Score', 'Play by Play', 'Shot Chart'],
  },
  {
    label: 'SETTINGS',
    items: ['Web Cast', 'Score Boards Settings'],
  },
  {
    label: 'HELP',
    items: ['Match Information', 'Terms & Condition', 'About'],
  },
];

const MenuBar: React.FC = () => {
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside the menu bar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (label: string) =>
    setOpen((prev) => (prev === label ? null : label));

  return (
    <div
      ref={barRef}
      className="flex items-center justify-between px-4 py-1.5 shrink-0 select-none relative z-50"
      style={{ backgroundColor: '#1E4DB7' }}
    >
      <div className="flex items-center gap-1">
        {MENUS.map(({ label, items }) => (
          <div key={label} className="relative">
            {/* Menu trigger */}
            <button
              onClick={() => toggle(label)}
                className={`text-white text-xs font-medium tracking-wide px-3 py-1 rounded transition-colors ${
                open === label ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {label}
            </button>

            {/* Dropdown panel */}
            {open === label && (
              <div className="absolute top-full left-0 mt-0 w-52 border border-gray-600 shadow-xl rounded-sm overflow-hidden" style={{ backgroundColor: '#1E4DB7' }}>
                {items.map((item) => (
                  <button
                    key={item}
                    onClick={() => setOpen(null)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors block"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-1">
        {(['−', '□', '✕'] as const).map((icon) => (
          <button
            key={icon}
            className="text-gray-400 hover:text-white text-sm w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MenuBar;
