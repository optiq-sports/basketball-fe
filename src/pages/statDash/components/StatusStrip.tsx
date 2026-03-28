import React from 'react';
import { BsBatteryCharging } from 'react-icons/bs';
import { IoWifi } from 'react-icons/io5';
import { cl } from '../utils/cl';

const StatusStrip: React.FC = () => {
  const labelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    fontSize: cl('9px', '0.8vw', '12px'),
    letterSpacing: 0.5,
  };

  return (
    <div
      className="flex shrink-0 flex-col gap-2.5 py-2.5 pl-0.5 pr-1.5"
      style={{ width: cl('80px', '7.5vw', '105px') }}
    >
      <div className="flex items-center gap-1.5">
        <BsBatteryCharging size={26} className="shrink-0 text-[#333]" aria-hidden />
        <span className="font-sans text-[#111]" style={labelStyle}>
          CHARGING
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <IoWifi size={22} className="shrink-0 text-[#222]" aria-hidden />
        <span className="font-sans text-[#111]" style={labelStyle}>
          CONNECTED
        </span>
      </div>
    </div>
  );
};

export default StatusStrip;
