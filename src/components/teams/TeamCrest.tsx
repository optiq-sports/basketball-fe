import React from 'react';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

export const safeColor = (c?: string | null): string | undefined => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : undefined);

/** Relative luminance (0 dark, 1 light) of a `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` colour; undefined if it isn't one. */
export function luminance(hex?: string | null): number | undefined {
  const c = safeColor(hex);
  if (!c) return undefined;
  let h = c.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
  if (h.length !== 6 && h.length !== 8) return undefined;
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Light team colours (white, pale yellow) need dark initials; white on white is unreadable. */
export const isLight = (hex?: string | null): boolean => (luminance(hex) ?? 0) > 0.45;

const SIZES = { sm: 'size-7 text-[10px]', md: 'size-10 text-xs', lg: 'size-12 text-sm' } as const;

/** A team's logo, or a colour-and-initials crest when it has none. Used anywhere a team is shown. */
export function TeamCrest({ name, code, logo, color, size = 'md', className }: { name: string; code?: string; logo?: string | null; color?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const resolved = safeColor(color);
  if (logo) {
    return <img src={logo} alt="" className={cn(SIZES[size], 'shrink-0 rounded-full object-cover', className)} />;
  }
  const initials = (code || normalizeName(name)).slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        SIZES[size],
        // A faint ring keeps a white or pale crest visible against a white card.
        'flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-inset ring-black/10',
        isLight(resolved) ? 'text-gray-900' : 'text-white',
        !resolved && 'bg-gray-400 dark:bg-gray-700',
        className,
      )}
      style={resolved ? { backgroundColor: resolved } : undefined}
    >
      {initials}
    </span>
  );
}
