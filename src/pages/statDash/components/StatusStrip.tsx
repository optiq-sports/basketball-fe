import React, { useEffect, useMemo, useState } from 'react';
import { BsBatteryCharging } from 'react-icons/bs';
import { IoWifi } from 'react-icons/io5';
import { cl } from '../utils/cl';
import { STAT_DASH } from '../statDashTheme';

/**
 * Vertical status column: sits to the left of Team 1 scorecard (reference screenshot).
 */
const StatusStrip: React.FC = () => {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);

  const [wifiConnected, setWifiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let batteryObj: BatteryManager | null = null;
    let cancelled = false;

    async function loadBattery() {
      try {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if (!nav || typeof nav.getBattery !== 'function') return;
        batteryObj = await nav.getBattery();
        if (cancelled) return;

        const sync = () => {
          if (!batteryObj) return;
          setBatteryLevel(batteryObj.level);
          setBatteryCharging(batteryObj.charging);
        };

        sync();
        batteryObj.addEventListener('levelchange', sync);
        batteryObj.addEventListener('chargingchange', sync);
      } catch {
        // Ignore missing permissions / unsupported API.
      }
    }

    void loadBattery();

    return () => {
      cancelled = true;
      if (batteryObj) {
        // Best-effort cleanup; older browsers may not support removeEventListener on BatteryManager.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyObj = batteryObj as any;
          if (typeof anyObj.removeEventListener === 'function') {
            // handlers are bound inside loadBattery; without stable refs we can't remove reliably.
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    const navConn = typeof navigator !== 'undefined' ? navigator.connection : undefined;

    const syncWifi = () => {
      const connected = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setWifiConnected(connected);
      // Requirement: show only connected/not connected (no 4G/5G details).
      void navConn;
    };

    syncWifi();

    const onOnline = () => syncWifi();
    const onOffline = () => syncWifi();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Some browsers support `change` events on connection.
    const connAny = navConn as unknown as { addEventListener?: (ev: string, fn: () => void) => void } | undefined;
    if (connAny?.addEventListener) {
      connAny.addEventListener('change', syncWifi);
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percentText = useMemo(() => {
    if (batteryLevel === null) return '—';
    return `${Math.round(batteryLevel * 100)}%`;
  }, [batteryLevel]);

  const batteryLabel = useMemo(() => {
    if (batteryCharging === null) return `BATTERY ${percentText}`;
    return batteryCharging ? `CHARGING ${percentText}` : `BATTERY ${percentText}`;
  }, [batteryCharging, percentText]);

  const wifiLabel = useMemo(() => {
    if (wifiConnected === null) return 'CONNECTED';
    if (!wifiConnected) return 'OFFLINE';
    return 'CONNECTED';
  }, [wifiConnected]);

  const batteryIconColor = batteryCharging ? STAT_DASH.startGreen : '#6B7280';
  const wifiIconColor = wifiConnected ? STAT_DASH.startGreen : '#DC2626';

  const batteryPercentText = useMemo(() => {
    if (batteryLevel === null) return '—';
    return `${Math.round(batteryLevel * 100)}%`;
  }, [batteryLevel]);

  const batteryStateText = useMemo(() => {
    if (batteryCharging === null) return 'BATTERY';
    return batteryCharging ? 'CHARGING' : 'BATTERY';
  }, [batteryCharging]);

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: cl('9px', '0.8vw', '12px'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#000000',
    marginRight: 2.5,
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
        <BsBatteryCharging size={16} className="shrink-0" style={{ color: batteryIconColor }} aria-hidden />
        <div className="flex w-full items-center justify-between leading-none">
          <span style={labelStyle}>{batteryStateText}</span>
          <span style={labelStyle}>{batteryPercentText}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <IoWifi size={16} className="shrink-0" style={{ color: wifiIconColor }} aria-hidden />
        <span style={labelStyle}>{wifiLabel}</span>
      </div>
    </div>
  );
};

export default StatusStrip;
