import React, { useState, useEffect } from 'react';
import { FiBattery, FiBatteryCharging, FiWifi, FiWifiOff, FiChevronUp, FiChevronDown } from 'react-icons/fi';

export interface ScoreboardProps {
  team1Name: string;
  team1Score: number;
  team1Color: string;
  team2Name: string;
  team2Score: number;
  team2Color: string;
  quarter: number;
  timeLeft: number;
  isRunning: boolean;
  onToggleClock: () => void;
  onAdjustTime: (delta: number) => void;
  onTimeout: () => void;
  onJumpBall: () => void;
  onSub: () => void;
}

const QUARTER_LABELS = ['1st', '2nd', '3rd', '4th'];

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ─── Device status hook ────────────a────────────────────────────────────────────
interface BatteryState {
  charging: boolean;
  level: number; // 0–1
}

function useDeviceStatus() {
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [online, setOnline]   = useState(navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // Battery Status API (Chrome/Edge; not available in Firefox/Safari)
    type BatteryManager = EventTarget & { charging: boolean; level: number };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };

    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((bat) => {
        const update = () => setBattery({ charging: bat.charging, level: bat.level });
        update();
        bat.addEventListener('chargingchange', update);
        bat.addEventListener('levelchange',    update);
      }).catch(() => {/* API blocked */});
    }

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { battery, online };
}

// ─── Battery colour based on level ────────────────────────────────────────────
function batteryColor(level: number, charging: boolean) {
  if (charging) return 'text-green-500';
  if (level > 0.5) return 'text-green-500';
  if (level > 0.2) return 'text-yellow-500';
  return 'text-red-500';
}

// ─── Scoreboard component ─────────────────────────────────────────────────────
const Scoreboard: React.FC<ScoreboardProps> = ({
  team1Name, team1Score, team1Color,
  team2Name, team2Score, team2Color,
  quarter, timeLeft, isRunning,
  onToggleClock, onAdjustTime,
  onTimeout, onJumpBall, onSub,
}) => {
  const quarterLabel = `${QUARTER_LABELS[quarter - 1] ?? `${quarter}th`} QUARTER`;
  const { battery, online } = useDeviceStatus();

  return (
    <div className="bg-[#F3F4F6] border-b border-gray-200 px-4 py-3 shrink-0">
      <div className="flex items-center gap-4 justify-evenly">
        {/* Device status — left side, vertical */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-2">
            {battery?.charging
              ? <FiBatteryCharging size={16} className="text-green-600" />
              : <FiBattery size={16} className={battery ? batteryColor(battery.level, false) : 'text-gray-500'} />
            }
            <span className="text-[11px] font-semibold text-gray-900 tracking-wide">
              {battery
                ? `${battery.charging ? 'CHARGING' : 'BATTERY'} ${Math.round(battery.level * 100)}%`
                : 'BATTERY N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {online
              ? <FiWifi size={16} className="text-gray-900" />
              : <FiWifiOff size={16} className="text-gray-900" />
            }
            <span className="text-[11px] font-semibold text-gray-900 tracking-wide">
              {online ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Team 1 card */}
        <div
          className="shrink-0 w-[410px] bg-white rounded-lg border border-gray-200 shadow-sm px-8 py-4 min-h-[150px] flex flex-col items-center justify-center"
          style={{ borderLeft: `5px solid ${team1Color}` }}
        >
          <span className="text-sm font-semibold text-gray-800 tracking-widest">{team1Name}</span>
          <span className="text-4xl font-bold text-gray-900 leading-none mt-1">{team1Score}</span>
        </div>

        {/* Clock section — quarter on top; clock + green STOP in one row; then T/O, JUMP-BALL, SUB */}
        <div className="shrink-0 w-[280px]">
          <div className="bg-gray-200 rounded-lg shadow-sm overflow-hidden border border-gray-200">
            {/* Quarter label — blue header strip */}
            <div className="bg-blue-600 text-white text-[10px] font-bold py-1 text-center tracking-widest whitespace-nowrap">
              {quarterLabel}
            </div>

            {/* Clock + green START/STOP in one row */}
            <div className="px-3 pt-2 pb-2">
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Add 30 seconds"
                    onClick={() => onAdjustTime(30)}
                    className="text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    <FiChevronUp size={16} />
                  </button>
                  <span className="text-gray-900 font-mono text-3xl font-bold tracking-widest">
                    {formatTime(timeLeft)}
                  </span>
                  <button
                    type="button"
                    title="Remove 30 seconds"
                    onClick={() => onAdjustTime(-30)}
                    className="text-gray-900 hover:text-gray-700 transition-colors"
                  >
                    <FiChevronDown size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onToggleClock}
                  className="px-8 py-2 rounded-md font-bold text-white text-sm shadow bg-green-600 hover:bg-green-700 whitespace-nowrap"
                >
                  {isRunning ? 'STOP' : 'START'}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3 mt-3">
            {[
              { label: 'T/O', action: onTimeout },
              { label: 'JUMP-BALL', action: onJumpBall },
              { label: 'SUB', action: onSub },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="px-5 py-1.5 bg-white border border-gray-200 rounded-md text-[11px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors shadow-sm"
              >
                {label}
              </button>
            ))}
          </div>
            </div>
          </div>
        </div>

        {/* Team 2 card */}
        <div
          className="shrink-0 w-[410px] bg-white rounded-lg border border-gray-200 shadow-sm px-8 py-4 min-h-[150px] flex flex-col items-center justify-center"
          style={{ borderRight: `5px solid ${team2Color}` }}
        >
          <span className="text-sm font-semibold text-gray-800 tracking-widest">{team2Name}</span>
          <span className="text-4xl font-bold text-gray-900 leading-none mt-1">{team2Score}</span>
        </div>

      </div>
    </div>
  );
};

export default Scoreboard;
