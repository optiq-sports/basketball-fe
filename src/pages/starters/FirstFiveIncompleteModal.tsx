import React from 'react';

export interface FirstFiveIncompleteModalProps {
  open: boolean;
  onClose: () => void;
  issues: { id: string; text: string }[];
}

/**
 * Shown when the user tries to continue or apply before both teams have five Playing and five First 5.
 */
const FirstFiveIncompleteModal: React.FC<FirstFiveIncompleteModalProps> = ({ open, onClose, issues }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-five-incomplete-title"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
        <h2 id="first-five-incomplete-title" className="text-lg font-bold text-gray-900">
          Finish both starting lineups
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          We need a little more from you before moving on. On <strong>each</strong> team, at least five players
          should be marked <strong>Playing</strong>, and exactly five should be marked <strong>Starter</strong> in
          the First 5 column.
        </p>
        {issues.length > 0 && (
          <ul className="mt-4 list-inside list-disc space-y-1.5 border-t border-gray-100 pt-4 text-sm text-gray-800">
            {issues.map((issue) => (
              <li key={issue.id}>{issue.text}</li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            OK, I’ll update the lineups
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstFiveIncompleteModal;
