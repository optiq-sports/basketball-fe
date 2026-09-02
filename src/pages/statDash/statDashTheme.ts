/** Pixel-perfect reference palette (screenshot spec). */
export const STAT_DASH = {
  pageBg: '#F3F4F6',
  accentBlue: '#3B82F6',
  homeRed: '#EF4444',
  awayYellow: '#EAB308',
  startGreen: '#22C55E',
  stopRed: '#DC2626',
  cardBorder: '#E5E7EB',
  logZebra: '#F1F5F9',
  fontStack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Inter', sans-serif",
} as const;

/**
 * GameCenter's outer grid: row 1 is the header (auto height, spans the center column only),
 * row 2 is player panels + court — this is what makes the panels' top edge land exactly at
 * the court's top edge instead of the header's.
 */
export const STAT_DASH_MAIN_INNER = 'grid w-full max-w-[min(100%,1220px)] shrink-0' as const;
// items-start (not items-center): on a short/narrow viewport the grid's content
// height is often less than the available panel height (the court/panels are
// sized by width, not height). Centering that leftover space stacks it evenly
// above AND below the content, which reads as a broken, half-empty layout.
// Anchoring to the top keeps the header/court/panels flush under the toolbar
// and pushes any leftover space to the bottom, where it reads as normal room
// to grow instead of a layout bug.
export const STAT_DASH_MAIN_OUTER = 'flex h-full w-full min-w-0 items-start justify-center overflow-y-auto' as const;
