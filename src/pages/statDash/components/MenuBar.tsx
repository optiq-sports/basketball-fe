import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from 'react-icons/vsc';
import { cl } from '../utils/cl';

type MenuGroupId = 'FILE' | 'GAME' | 'REPORTS' | 'SETTINGS' | 'HELP';

type MenuItemDef = {
  label: string;
  /** Called when the item is chosen; omit for no-op placeholders */
  onSelect?: () => void;
};

const MENU_GROUPS: { id: MenuGroupId; items: MenuItemDef[] }[] = [
  {
    id: 'FILE',
    items: [
      { label: 'Close Game' },
      { label: 'Exit' },
    ],
  },
  {
    id: 'GAME',
    items: [
      { label: 'Switch Team Side' },
      { label: 'Starters' },
      { label: 'Setup Quarters' },
      { label: 'Finish Match' },
      { label: 'Export Game' },
    ],
  },
  {
    id: 'REPORTS',
    items: [
      { label: 'Box Score' },
      { label: 'Play by Play' },
      { label: 'Shot Chart' },
    ],
  },
  {
    id: 'SETTINGS',
    items: [
      { label: 'Web Cast' },
      { label: 'Score Boards Settings' },
    ],
  },
  {
    id: 'HELP',
    items: [
      { label: 'Match Information' },
      { label: 'Terms & Condition' },
      { label: 'About' },
    ],
  },
];

const labelFontSize = { fontSize: cl('10px', '1vw', '12px') };

export interface MenuBarProps {
  onSwitchTeamSide?: () => void;
  onStarters?: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onSwitchTeamSide, onStarters }) => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<MenuGroupId | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenId(null), []);

  const attachActions = useCallback(
    (group: (typeof MENU_GROUPS)[number]): MenuItemDef[] => {
      if (group.id === 'GAME') {
        return group.items.map((item) => {
          if (item.label === 'Switch Team Side') {
            return {
              ...item,
              onSelect: () => {
                close();
                onSwitchTeamSide?.();
              },
            };
          }
          if (item.label === 'Starters') {
            return {
              ...item,
              onSelect: () => {
                close();
                onStarters?.();
              },
            };
          }
          return item;
        });
      }
      if (group.id !== 'FILE') return group.items;
      return group.items.map((item) => {
        if (item.label === 'Exit' || item.label === 'Close Game') {
          return {
            ...item,
            onSelect: () => {
              close();
              setExitConfirmOpen(true);
            },
          };
        }
        return item;
      });
    },
    [close, onSwitchTeamSide, onStarters]
  );

  useEffect(() => {
    if (openId === null) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId, close]);

  const confirmExit = useCallback(() => {
    setExitConfirmOpen(false);
    navigate('/match-key');
  }, [navigate]);

  const cancelExit = useCallback(() => {
    setExitConfirmOpen(false);
  }, []);

  return (
    <>
      <header
        ref={rootRef}
        className="relative z-50 flex shrink-0 select-none items-center justify-between border-t border-[#2d2d2d] bg-black px-4 text-white sm:px-5"
        style={{ height: 36, minHeight: 36 }}
      >
        <div className="flex min-w-0 items-center gap-[clamp(10px,1.8vw,24px)]">
          <nav className="flex items-start gap-[clamp(10px,1.8vw,24px)]" aria-label="Main menu">
            {MENU_GROUPS.map((group) => {
              const isOpen = openId === group.id;
              const items = attachActions(group);
              return (
                <div key={group.id} className="relative flex flex-col items-stretch pt-0.5">
                  <button
                    type="button"
                    className="cursor-pointer bg-transparent p-0 text-left font-sans font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    style={labelFontSize}
                    aria-haspopup="menu"
                    aria-controls={`menu-panel-${group.id}`}
                    id={`menu-trigger-${group.id}`}
                    onClick={() => setOpenId((cur) => (cur === group.id ? null : group.id))}
                  >
                    {group.id}
                  </button>
                  {isOpen && (
                    <div
                      role="menu"
                      id={`menu-panel-${group.id}`}
                      aria-labelledby={`menu-trigger-${group.id}`}
                      className="absolute left-0 top-full z-50 mt-0 min-w-[12.5rem] border border-neutral-800 bg-black py-1 shadow-lg"
                    >
                      {items.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          className="block w-full whitespace-nowrap px-3 py-2 text-left text-sm font-bold text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                          onClick={() => {
                            item.onSelect?.();
                            close();
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-5">
          <button type="button" className="flex text-white hover:opacity-80" aria-label="Minimize">
            <VscChromeMinimize size={14} strokeWidth={0.5} />
          </button>
          <button type="button" className="flex text-white hover:opacity-80" aria-label="Maximize">
            <VscChromeMaximize size={14} strokeWidth={0.5} />
          </button>
          <button
            type="button"
            className="flex text-white hover:opacity-80"
            aria-label="Close"
            onClick={() => setExitConfirmOpen(true)}
          >
            <VscChromeClose size={14} strokeWidth={0.5} />
          </button>
        </div>
      </header>

      {exitConfirmOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-confirm-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <h2 id="exit-confirm-title" className="text-base font-bold text-gray-900">
              Exit game?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to exit this game screen?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelExit}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MenuBar;
