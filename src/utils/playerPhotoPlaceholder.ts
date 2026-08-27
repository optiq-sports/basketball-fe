import type { SyntheticEvent } from 'react';

/**
 * Generic avatar icon (circle background + person silhouette), used whenever the API
 * returns no `photo` URL, or a `photo` URL that fails to load — no stock photos, just a
 * clean placeholder icon like any other admin dashboard's default avatar.
 */
const AVATAR_ICON_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#F2F4F7"/>
      <circle cx="50" cy="39" r="17" fill="#98A2B3"/>
      <path d="M50 60c-19 0-34 11-34 26v14h68V86c0-15-15-26-34-26Z" fill="#98A2B3"/>
    </svg>`,
  );

/** @deprecated kept only so old imports don't break; returns the same icon as everything else now. */
export function placeholderPortraitForSeed(_seed: string | number): string {
  return AVATAR_ICON_SVG;
}

/**
 * Returns the real `photo` URL when present; otherwise a generic avatar icon.
 */
export function resolvePlayerPhotoUrl(
  photo: string | undefined | null,
  _seed: string | number
): string {
  const p = typeof photo === 'string' ? photo.trim() : '';
  return p || AVATAR_ICON_SVG;
}

/**
 * `onError` handler for `<img>` tags using `resolvePlayerPhotoUrl`: the API can return a
 * `photo` URL that 404s or fails to load (deleted Cloudinary asset, bad URL, network blip) —
 * `resolvePlayerPhotoUrl` only covers a *missing* URL, not a broken one. Attach this to swap
 * to the avatar icon at runtime instead of showing the browser's broken-image icon.
 */
export function handlePhotoLoadError(_seed: string | number) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src === AVATAR_ICON_SVG) return; // already showing the fallback — avoid a loop
    img.src = AVATAR_ICON_SVG;
  };
}
