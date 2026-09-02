import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { cl } from '../utils/cl';
import { GATEWAY_DISPLAY_FONT_STACK } from '../../../authGatewayTheme';
import StatusStrip from './StatusStrip';

const StatusDot: React.FC<{ colorClass: string; blink?: boolean }> = ({ colorClass, blink }) => (
  <span
    className={`inline-block size-1.5 shrink-0 rounded-full ${colorClass} ${blink ? 'motion-safe:animate-status-dot-blink' : ''}`}
    aria-hidden
  />
);

type MenuGroupId = 'FILE' | 'GAME' | 'REPORTS' | 'SETTINGS' | 'HELP';

type MenuItemDef = {
  label: string;
  /** Called when the item is chosen; omit for no-op placeholders */
  onSelect?: () => void;
  disabled?: boolean;
};

const MENU_GROUPS: { id: MenuGroupId; items: MenuItemDef[] }[] = [
  {
    id: 'FILE',
    items: [
      { label: 'Close Game' },
      { label: 'Cancel Game' },
      { label: 'Exit' },
    ],
  },
  {
    id: 'GAME',
    items: [
      { label: 'Switch Team Side' },
      { label: 'Starters' },
      { label: 'Clear game log' },
      { label: 'Setup Quarters' },
      { label: 'Pause Game' },
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
  onClearGameLog?: () => void;
  /** Current backend GameSession status — drives the Pause/Resume label and disables terminal-state actions. */
  sessionStatus?: string;
  onPauseResume?: () => void;
  pauseInFlight?: boolean;
  onFinishMatch?: () => void;
  onCancelGame?: () => void;
  /** Realtime (SSE) connection status */
  realtimeConnected?: boolean;
  realtimeReconnecting?: boolean;
  /** Event queue sync status */
  isOnline?: boolean;
  failedCount?: number;
  pendingCount?: number;
  onRetryFailed?: () => void;
  isBootstrapping?: boolean;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onSwitchTeamSide,
  onStarters,
  onClearGameLog,
  sessionStatus,
  onPauseResume,
  pauseInFlight,
  onFinishMatch,
  onCancelGame,
  realtimeConnected = false,
  realtimeReconnecting = false,
  isOnline = true,
  failedCount = 0,
  pendingCount = 0,
  onRetryFailed,
  isBootstrapping = false,
}) => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<MenuGroupId | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPaused = sessionStatus === 'PAUSED';
  const isTerminal = sessionStatus === 'COMPLETED' || sessionStatus === 'CANCELLED';

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
          if (item.label === 'Clear game log') {
            return {
              ...item,
              onSelect: () => {
                close();
                onClearGameLog?.();
              },
            };
          }
          if (item.label === 'Pause Game') {
            return {
              ...item,
              label: pauseInFlight
                ? isPaused
                  ? 'Resuming…'
                  : 'Pausing…'
                : isPaused
                  ? 'Resume Game'
                  : 'Pause Game',
              disabled: isTerminal || pauseInFlight,
              onSelect: () => {
                close();
                onPauseResume?.();
              },
            };
          }
          if (item.label === 'Finish Match') {
            return {
              ...item,
              disabled: isTerminal,
              onSelect: () => {
                close();
                onFinishMatch?.();
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
        if (item.label === 'Cancel Game') {
          return {
            ...item,
            disabled: isTerminal,
            onSelect: () => {
              close();
              onCancelGame?.();
            },
          };
        }
        return item;
      });
    },
    [
      close,
      onSwitchTeamSide,
      onStarters,
      onClearGameLog,
      isPaused,
      isTerminal,
      pauseInFlight,
      onPauseResume,
      onFinishMatch,
      onCancelGame,
    ]
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
        className="relative z-50 flex shrink-0 select-none items-center justify-between border-b border-black/40 bg-[#111827] px-4 text-white sm:px-5"
        style={{ height: 44, minHeight: 44 }}
      >
        <div className="flex min-w-0 items-center gap-[clamp(14px,2.2vw,28px)]">
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <circle cx="9" cy="9" r="8.5" fill="#1F2937" stroke="#374151" />
              <path d="M9 0.5 A8.5 8.5 0 0 1 9 17.5 Z" fill="#EA580C" />
            </svg>
            <span
              className="select-none leading-none text-white"
              style={{ fontFamily: GATEWAY_DISPLAY_FONT_STACK, fontSize: 16, letterSpacing: 1 }}
              aria-hidden
            >
              OPTIQ
            </span>
          </div>
          <span className="hidden h-4 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
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
                          disabled={item.disabled}
                          aria-disabled={item.disabled}
                          className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm font-bold focus:outline-none ${
                            item.disabled
                              ? 'cursor-not-allowed text-gray-600'
                              : 'text-white hover:bg-white/10 focus:bg-white/10'
                          }`}
                          onClick={() => {
                            if (item.disabled) return;
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

        <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
          <div className="hidden items-center gap-3 border-r border-white/10 pr-3 sm:flex sm:gap-4 sm:pr-4">
            <span
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400"
              title={isBootstrapping ? 'Syncing game session…' : undefined}
            >
              <StatusDot
                colorClass={realtimeReconnecting ? 'bg-amber-500' : realtimeConnected ? 'bg-emerald-500' : 'bg-gray-500'}
                blink={realtimeReconnecting}
              />
              {realtimeReconnecting ? 'Reconnecting…' : realtimeConnected ? 'Live' : 'Offline'}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <StatusDot
                colorClass={
                  !isOnline
                    ? 'bg-orange-500'
                    : failedCount > 0
                      ? 'bg-red-500'
                      : pendingCount > 0
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                }
                blink={!isOnline || failedCount > 0 || pendingCount > 0}
              />
              {!isOnline ? (
                'Offline'
              ) : failedCount > 0 ? (
                <>
                  {failedCount} failed
                  {onRetryFailed && (
                    <button type="button" className="ml-1 underline hover:text-white" onClick={onRetryFailed}>
                      Retry
                    </button>
                  )}
                </>
              ) : pendingCount > 0 ? (
                `${pendingCount} queued`
              ) : (
                'Synced'
              )}
            </span>
            <StatusStrip />
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 transition-colors hover:text-white"
            aria-label="Exit game screen"
            onClick={() => setExitConfirmOpen(true)}
          >
            <FiLogOut size={14} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {exitConfirmOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-confirm-title"
        >
          <div className="w-full max-w-sm border-2 border-gray-800 bg-white p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]">
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
                className="border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmExit}
                className="bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
