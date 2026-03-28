import React, { useCallback, useEffect, useState } from 'react';
import {
  enterFullscreenBestEffort,
  isDocumentFullscreen,
  STATISTICIAN_FULLSCREEN_GATE_KEY,
} from '../utils/enterFullscreen';

function gateDismissed(): boolean {
  try {
    return sessionStorage.getItem(STATISTICIAN_FULLSCREEN_GATE_KEY) === '1';
  } catch {
    return false;
  }
}

function shouldShowGate(): boolean {
  if (typeof window === 'undefined') return false;
  if (gateDismissed()) return false;
  return !isDocumentFullscreen();
}

/**
 * Blocks statistician UI until the user taps to enter fullscreen (valid user gesture)
 * or skips. Needed because programmatic fullscreen after async login often fails.
 */
const StatisticianFullscreenGate: React.FC = () => {
  const [visible, setVisible] = useState(shouldShowGate);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STATISTICIAN_FULLSCREEN_GATE_KEY, '1');
    } catch {
      /* private mode */
    }
    setVisible(false);
  }, []);

  const handleEnterFullscreen = useCallback(() => {
    enterFullscreenBestEffort();
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    const sync = () => {
      if (isDocumentFullscreen()) dismiss();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f172a]/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stat-fullscreen-gate-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 shadow-xl">
        <h2
          id="stat-fullscreen-gate-title"
          className="text-center text-lg font-semibold text-gray-900"
        >
          Full screen
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">
          Tap below for full screen scoring mode. You can skip if your browser does not allow it.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={handleEnterFullscreen}
            className="min-h-[48px] flex-1 rounded-xl bg-[#3B5998] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5998] focus-visible:ring-offset-2"
          >
            Enter full screen
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-[48px] flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatisticianFullscreenGate;
