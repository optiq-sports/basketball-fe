/**
 * Stock portrait paths under Vite `public/` (see Players, Tournaments, PendingGames, etc.).
 * Used whenever the API returns no `photo` URL so lists and forms still show an image.
 */
export const PLACEHOLDER_PORTRAIT_URLS = [
  '/player1.png',
  '/player2.png',
  '/player3.png',
  '/avatar1.png',
  '/avatar2.png',
  '/avatar3.png',
  '/avatar4.png',
  '/avatar5.png',
  '/avatar6.png',
  '/dplayer.png',
  '/stat.png',
] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic placeholder for a stable id (player id, row key, etc.). */
export function placeholderPortraitForSeed(seed: string | number): string {
  const idx = hashSeed(String(seed)) % PLACEHOLDER_PORTRAIT_URLS.length;
  return PLACEHOLDER_PORTRAIT_URLS[idx];
}

/**
 * Returns the real `photo` URL when present; otherwise a stable placeholder from `seed`.
 */
export function resolvePlayerPhotoUrl(
  photo: string | undefined | null,
  seed: string | number
): string {
  const p = typeof photo === 'string' ? photo.trim() : '';
  if (p) return p;
  return placeholderPortraitForSeed(seed);
}
