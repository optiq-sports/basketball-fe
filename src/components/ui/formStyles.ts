/**
 * The pre-redesign form and button classes, in one place.
 *
 * Every admin screen before the redesign repeated these same strings inline — `px-4 py-2` fields with
 * a `brand` focus ring, `rounded-lg` buttons, a `border-t` footer. Restoring the pages one at a time
 * meant copying them around again, so they live here instead: the look is identical, and a change to
 * it happens once.
 *
 * These are plain strings rather than components on purpose. The old markup varied — a field is
 * sometimes an input, sometimes a select, sometimes a file picker with its own `file:` classes — and a
 * component per shape would be more abstraction than the pages need.
 */

/** A text input, select or date field. Add `cursor-pointer` to a select. */
export const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent aria-[invalid=true]:border-error-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5';

/** The same field, for a `<select>`. */
export const selectClass = `cursor-pointer ${inputClass}`;

/** A field label, sitting above its control. */
export const labelClass = 'block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300';

/** Help text under a field. */
export const hintClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

/** A validation message under a field. */
export const fieldErrorClass = 'mt-1 text-xs text-error-600 dark:text-error-500';

/** The filled primary action. */
export const btnPrimary =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70';

/** An outlined secondary action, usually Cancel. */
export const btnSecondary =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5';

/** A destructive action — deleting, merging, anything that loses data. */
export const btnDanger =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-error-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-error-600 disabled:cursor-not-allowed disabled:opacity-50';

/** The larger page-level primary button, as the old toolbars used. */
export const btnPrimaryLg =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50';

/** Its outlined sibling. */
export const btnSecondaryLg =
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5';

/** A server error, above a form. */
export const errorBanner =
  'rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500';

/** The divided footer a dialog's actions sit on. */
export const dialogFooter = 'flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800';

/** A small icon-only row action. `tone` picks the colour. */
export const iconButton = (tone: 'brand' | 'warning' | 'error' = 'brand'): string => {
  const tones = {
    brand: 'text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10',
    warning: 'text-warning-600 hover:bg-warning-50 dark:text-warning-500 dark:hover:bg-warning-500/10',
    error: 'text-error-600 hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10',
  };
  return `cursor-pointer rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`;
};
