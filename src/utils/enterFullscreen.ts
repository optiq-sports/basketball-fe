type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
  msRequestFullscreen?: () => void;
};

/** Session flag: user completed or skipped the statistician fullscreen prompt. */
export const STATISTICIAN_FULLSCREEN_GATE_KEY = 'statistician_fullscreen_gate_done';

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    document.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.msFullscreenElement
  );
}

/**
 * Requests browser fullscreen on the document root. Browsers may reject this
 * if it is not tied to a recent user gesture; callers should still invoke it
 * at the best available moment (e.g. right after statistician login success).
 */
export function enterFullscreenBestEffort(): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement as FullscreenElement | null;
  if (!el) return;

  try {
    if (typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => {});
      return;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
      return;
    }
    if (typeof el.msRequestFullscreen === 'function') {
      el.msRequestFullscreen();
    }
  } catch {
    // ignore
  }
}
