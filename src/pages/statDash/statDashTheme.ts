/** Pixel-perfect reference palette (screenshot spec). */
export const STAT_DASH = {
  pageBg: '#F9FAFB',
  accentBlue: '#3B82F6',
  homeRed: '#EF4444',
  awayYellow: '#EAB308',
  startGreen: '#22C55E',
  stopRed: '#DC2626',
  cardBorder: '#E5E7EB',
  logZebra: '#F1F5F9',
  fontStack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Inter', sans-serif",
} as const;

/** Same max width + centering as GameCenter so GameLog stays aligned at every breakpoint */
export const STAT_DASH_MAIN_INNER =
  'flex w-full max-w-[min(100%,900px)] shrink-0' as const;
export const STAT_DASH_MAIN_OUTER = 'flex w-full min-w-0 justify-center' as const;
