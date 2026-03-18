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
    <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
      <div className="flex items-center gap-3">
        {/* Device status — left side, vertical */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex items-center gap-1">
            {battery?.charging
              ? <FiBatteryCharging size={13} className="text-green-500" />
              : <FiBattery size={13} className={battery ? batteryColor(battery.level, false) : 'text-gray-400'} />
            }
            <span className={`text-[10px] font-semibold tracking-wide ${
              battery ? batteryColor(battery.level, battery.charging) : 'text-gray-400'
            }`}>
              {battery
                ? `${battery.charging ? 'CHARGING' : 'BATTERY'} ${Math.round(battery.level * 100)}%`
                : 'BATTERY N/A'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {online
              ? <FiWifi    size={13} className="text-green-500" />
              : <FiWifiOff size={13} className="text-red-500"   />
            }
            <span className={`text-[10px] font-semibold tracking-wide ${
              online ? 'text-green-600' : 'text-red-500'
            }`}>
              {online ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Team 1 card */}
        <div
          className="flex-1 bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-2 flex flex-col items-center"
          style={{ borderLeft: `5px solid ${team1Color}` }}
        >
          <span className="text-sm font-bold text-gray-800 tracking-widest">{team1Name}</span>
          <span className="text-4xl font-bold text-gray-900 leading-none mt-0.5">{team1Score}</span>
        </div>

        {/* Clock section — quarter on top; clock + green STOP in one row; then T/O, JUMP-BALL, SUB */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {/* Quarter label — blue header strip */}
          <div className="bg-blue-600 text-white text-[11px] font-bold px-5 py-1 rounded-t tracking-widest whitespace-nowrap">
            {quarterLabel}
          </div>

          {/* Clock + green START/STOP in one row (per design image) */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-b-lg px-2 py-2">
            <div className="bg-gray-900 rounded flex items-center gap-2 px-3 py-2">
              <button
                title="Add 30 seconds"
                onClick={() => onAdjustTime(30)}
                className="text-white hover:text-gray-300 transition-colors flex flex-col items-center"
              >
                <FiChevronUp size={16} />
              </button>
              <span className="text-white font-mono text-2xl font-bold tracking-widest w-24 text-center">
                {formatTime(timeLeft)}
              </span>
              <button
                title="Remove 30 seconds"
                onClick={() => onAdjustTime(-30)}
                className="text-white hover:text-gray-300 transition-colors flex flex-col items-center"
              >
                <FiChevronDown size={16} />
              </button>
            </div>
            <button
              onClick={onToggleClock}
              className="py-2 px-4 rounded font-bold text-white text-sm transition-all shadow bg-green-500 hover:bg-green-600 whitespace-nowrap"
            >
              {isRunning ? 'STOP' : 'START'}
            </button>
          </div>

          {/* Action buttons — T/O, JUMP-BALL, SUB */}
          <div className="flex items-center gap-2">
            {[
              { label: 'T/O', action: onTimeout },
              { label: 'JUMP-BALL', action: onJumpBall },
              { label: 'SUB', action: onSub },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="px-5 py-1.5 bg-gray-100 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors shadow-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Team 2 card */}
        <div
          className="flex-1 bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-2 flex flex-col items-center"
          style={{ borderRight: `5px solid ${team2Color}` }}
        >
          <span className="text-sm font-bold text-gray-800 tracking-widest">{team2Name}</span>
          <span className="text-4xl font-bold text-gray-900 leading-none mt-0.5">{team2Score}</span>
        </div>

      </div>
    </div>
  );
};

export default Scoreboard;
