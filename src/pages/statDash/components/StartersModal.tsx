import React, { useEffect, useState } from 'react';
import type { TeamLineup } from '../substitutionLineupUtils';
import StartersFlow from '../../starters/StartersFlow';

export interface StartersModalProps {
  open: boolean;
  onClose: () => void;
  homeLineup: TeamLineup;
  awayLineup: TeamLineup;
  onApply: (lineups: { home: TeamLineup; away: TeamLineup }) => void;
}

/** In-app Starters editor (same content as /starters) without leaving Stat Dash. */
const StartersModal: React.FC<StartersModalProps> = ({
  open,
  onClose,
  homeLineup,
  awayLineup,
  onApply,
}) => {
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (open) setResetKey((k) => k + 1);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[210] flex items-center justify-center bg-black/35 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="starters-modal-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col rounded-lg border border-gray-200 bg-[#F0F2F5] p-3 shadow-xl sm:p-4">
        <h2 id="starters-modal-title" className="shrink-0 text-lg font-bold text-gray-900">
          Starters
        </h2>
        <p className="mt-1 shrink-0 text-sm text-gray-600">
          Team colors, playing status, and first five. If something’s missing, <strong>Apply</strong> opens a short
          reminder — both teams need five <strong>Playing</strong> and five <strong>First 5</strong> starters.{' '}
          <strong>Cancel</strong> closes without saving.
        </p>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-[#F0F2F5] px-2 py-3 sm:px-4">
          <StartersFlow
            key={resetKey}
            variant="embedded"
            initialHomeLineup={homeLineup}
            initialAwayLineup={awayLineup}
            baselineHomeLineup={homeLineup}
            baselineAwayLineup={awayLineup}
            onApplyLineups={(lineups) => {
              onApply(lineups);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default StartersModal;
