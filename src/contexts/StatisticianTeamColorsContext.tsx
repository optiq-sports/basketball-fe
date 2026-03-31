import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STAT_DASH } from '../pages/statDash/statDashTheme';

export const STATISTICIAN_TEAM_COLOR_HOME_KEY = 'statistician_team_color_home';
export const STATISTICIAN_TEAM_COLOR_AWAY_KEY = 'statistician_team_color_away';

function loadStored(key: string, fallback: string): string {
  try {
    const v = sessionStorage.getItem(key);
    if (v && isValidHexColor(v)) return normalizeHex(v)!;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function isValidHexColor(value: string): boolean {
  return normalizeHex(value) !== null;
}

export function isLightColor(value: string): boolean {
  const n = normalizeHex(value);
  if (!n) return false;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 180;
}

export function getContrastTextColor(value: string): '#111827' | '#ffffff' {
  const n = normalizeHex(value);
  if (!n) return '#ffffff';
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#111827' : '#ffffff';
}

/** Returns `#RRGGBB` or null if invalid */
export function normalizeHex(value: string): string | null {
  let s = value.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) {
    return s.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

export type StatisticianTeamColorsValue = {
  homeTeamColor: string;
  awayTeamColor: string;
  setHomeTeamColor: (color: string) => void;
  setAwayTeamColor: (color: string) => void;
};

const StatisticianTeamColorsContext = createContext<StatisticianTeamColorsValue | null>(null);

/**
 * Read persisted home/away jersey colors without React (utilities, services, or non-provider trees).
 * Defaults match `STAT_DASH` when nothing is stored.
 */
export function readStatisticianTeamColorsFromStorage(): Pick<
  StatisticianTeamColorsValue,
  'homeTeamColor' | 'awayTeamColor'
> {
  return {
    homeTeamColor: loadStored(STATISTICIAN_TEAM_COLOR_HOME_KEY, STAT_DASH.homeRed),
    awayTeamColor: loadStored(STATISTICIAN_TEAM_COLOR_AWAY_KEY, STAT_DASH.awayYellow),
  };
}

export const StatisticianTeamColorsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [homeTeamColor, setHomeState] = useState(() =>
    loadStored(STATISTICIAN_TEAM_COLOR_HOME_KEY, STAT_DASH.homeRed)
  );
  const [awayTeamColor, setAwayState] = useState(() =>
    loadStored(STATISTICIAN_TEAM_COLOR_AWAY_KEY, STAT_DASH.awayYellow)
  );

  const setHomeTeamColor = useCallback((color: string) => {
    const n = normalizeHex(color);
    if (!n) return;
    setHomeState(n);
    try {
      sessionStorage.setItem(STATISTICIAN_TEAM_COLOR_HOME_KEY, n);
    } catch {
      /* ignore */
    }
  }, []);

  const setAwayTeamColor = useCallback((color: string) => {
    const n = normalizeHex(color);
    if (!n) return;
    setAwayState(n);
    try {
      sessionStorage.setItem(STATISTICIAN_TEAM_COLOR_AWAY_KEY, n);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      homeTeamColor,
      awayTeamColor,
      setHomeTeamColor,
      setAwayTeamColor,
    }),
    [homeTeamColor, awayTeamColor, setHomeTeamColor, setAwayTeamColor]
  );

  return (
    <StatisticianTeamColorsContext.Provider value={value}>{children}</StatisticianTeamColorsContext.Provider>
  );
};

/**
 * Use inside `StatisticianTeamColorsProvider` (statistician routes).
 * Colors persist in sessionStorage and stay in sync across Match Key → Starters → Stat Dash.
 */
export function useStatisticianTeamColors(): StatisticianTeamColorsValue {
  const ctx = useContext(StatisticianTeamColorsContext);
  if (!ctx) {
    throw new Error('useStatisticianTeamColors must be used within StatisticianTeamColorsProvider');
  }
  return ctx;
}
