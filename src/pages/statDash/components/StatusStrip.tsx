import React from 'react';
import { BsBatteryCharging } from 'react-icons/bs';
import { IoWifi } from 'react-icons/io5';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

/**
 * Vertical status column: sits to the left of Team 1 scorecard (reference screenshot).
 */
const StatusStrip: React.FC = () => {
  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: cl('9px', '0.8vw', '12px'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#000000',
  };

  return (
    <div
      className="flex shrink-0 flex-col gap-2.5 self-start pt-1 font-sans"
      style={{
        width: cl('80px', '7.5vw', '105px'),
        padding: '2px 6px 0 2px',
      }}
    >
      <div className="flex items-center gap-1.5">
        <BsBatteryCharging size={26} className="shrink-0" style={{ color: STAT_DASH.startGreen }} aria-hidden />
        <span style={labelStyle}>CHARGING</span>
      </div>
      <div className="flex items-center gap-1.5">
        <IoWifi size={22} className="shrink-0 text-gray-900" aria-hidden />
        <span style={labelStyle}>CONNECTED</span>
      </div>
    </div>
  );
};

export default StatusStrip;
