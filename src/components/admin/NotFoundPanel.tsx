import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiCompass } from 'react-icons/fi';
import { btnPrimary, btnSecondary } from '../ui/formStyles';

/**
 * What an admin sees for a URL the shell has no route for.
 *
 * Before this existed, any unmatched path under the admin shell rendered the sidebar and topbar with a
 * completely empty content area: no message, and no way back except the nav (Bug 203). That was true
 * before the redesign too, so it is an old gap rather than a regression.
 *
 * It offers the path it could not match, so a mistyped or stale link is obvious, and two ways out.
 */
const NotFoundPanel: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <FiCompass aria-hidden size={28} />
      </span>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">This page doesn’t exist</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Nothing is set up at this address. The link may be out of date, or the record it pointed to may
        have been deleted.
      </p>
      <code className="mt-4 max-w-full truncate rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-400">
        {pathname}
      </code>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link to="/dashboard" className={btnPrimary}>Go to the dashboard</Link>
        <button type="button" onClick={() => window.history.back()} className={btnSecondary}>
          <FiArrowLeft aria-hidden size={16} />
          Back
        </button>
      </div>
    </div>
  );
};

export default NotFoundPanel;
