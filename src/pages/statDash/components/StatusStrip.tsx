import React, { useEffect, useMemo, useState } from 'react';
import { BsBatteryCharging } from 'react-icons/bs';
import { IoWifi } from 'react-icons/io5';
import { STAT_DASH } from '../statDashTheme';

/**
 * Compact inline battery + wifi indicator for the dark toolbar (MenuBar).
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

  const batteryPercentText = useMemo(() => {
    if (batteryLevel === null) return '—';
    return `${Math.round(batteryLevel * 100)}%`;
  }, [batteryLevel]);

  const batteryIconColor = batteryCharging ? STAT_DASH.startGreen : '#9CA3AF';
  const wifiIconColor = wifiConnected ? STAT_DASH.startGreen : '#F87171';
  const wifiLabel = wifiConnected === false ? 'Offline' : 'Online';

  return (
    <div className="flex shrink-0 items-center gap-3 font-sans text-xs font-medium text-gray-400">
      <span className="flex items-center gap-1" title={batteryCharging ? 'Charging' : 'Battery'}>
        <BsBatteryCharging size={14} className="shrink-0" style={{ color: batteryIconColor }} aria-hidden />
        {batteryPercentText}
      </span>
      <span className="flex items-center gap-1" title={wifiLabel}>
        <IoWifi size={14} className="shrink-0" style={{ color: wifiIconColor }} aria-hidden />
        <span className="hidden sm:inline">{wifiLabel}</span>
      </span>
    </div>
  );
};

export default StatusStrip;
