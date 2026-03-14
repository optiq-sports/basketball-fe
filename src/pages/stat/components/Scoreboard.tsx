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

// ─── Device status hook ────────────────────────────────────────────────────────
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
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 shrink-0">
      <div className="flex items-center gap-4">
        {/* Device status — far left, vertical, aligned with menu */}
        <div className="flex flex-col gap-1.5 shrink-0">
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

        {/* Team 1 — white box, thin red left edge */}
        <div
          className="flex-1 max-w-[140px] bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 flex flex-col items-center shrink-0"
          style={{ borderLeftWidth: 4, borderLeftColor: team1Color }}
        >
          <span className="text-xs font-bold text-gray-800 tracking-widest">{team1Name}</span>
          <span className="text-3xl font-bold text-gray-900 leading-none mt-1">{team1Score}</span>
        </div>

        {/* Central box — white, thin blue top border; quarter then clock+STOP then T/O row */}
        <div className="flex flex-col items-center shrink-0 border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white" style={{ borderTopWidth: 4, borderTopColor: '#2563eb' }}>
          <div className="bg-blue-600 text-white text-[11px] font-bold px-5 py-1.5 tracking-widest whitespace-nowrap w-full text-center">
            {quarterLabel}
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="bg-gray-900 rounded flex items-center gap-2 px-2 py-2">
              <button title="Add 30 seconds" onClick={() => onAdjustTime(30)} className="text-white hover:text-gray-300 transition-colors p-0.5">
                <FiChevronUp size={14} />
              </button>
              <span className="text-white font-mono text-xl font-bold tracking-widest w-20 text-center">{formatTime(timeLeft)}</span>
              <button title="Remove 30 seconds" onClick={() => onAdjustTime(-30)} className="text-white hover:text-gray-300 transition-colors p-0.5">
                <FiChevronDown size={14} />
              </button>
            </div>
            <button
              onClick={onToggleClock}
              className="py-2 px-4 rounded font-bold text-white text-sm shadow bg-green-500 hover:bg-green-600 whitespace-nowrap"
            >
              {isRunning ? 'STOP' : 'START'}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 pb-2">
            {[
              { label: 'T/O', action: onTimeout },
              { label: 'JUMP-BALL', action: onJumpBall },
              { label: 'SUB', action: onSub },
            ].map(({ label, action }) => (
              <button key={label} onClick={action} className="px-4 py-1.5 bg-gray-200 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-300 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Team 2 — white box, thin yellow right edge */}
        <div
          className="flex-1 max-w-[140px] bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 flex flex-col items-center shrink-0"
          style={{ borderRightWidth: 4, borderRightColor: team2Color }}
        >
          <span className="text-xs font-bold text-gray-800 tracking-widest">{team2Name}</span>
          <span className="text-3xl font-bold text-gray-900 leading-none mt-1">{team2Score}</span>
        </div>

      </div>
    </div>
  );
};

export default Scoreboard;
