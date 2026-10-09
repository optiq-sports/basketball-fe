/**
 * Fixes a name stored in ALL CAPS (or all lowercase) into Title Case for display, without touching a
 * name that already has intentional mixed case (e.g. "McLaren", "iTeam"). "Sentence case" in the
 * literal sense (only the first letter capitalised) reads oddly for a multi-word proper noun like a
 * team name ("Marktown flyers"), so this normalizes word-by-word instead — the same fix, applied the
 * way sports apps actually display team, player and tournament names.
 *
 * Known limitation: an all-caps acronym inside a shouting name (e.g. "FC BARCELONA") becomes "Fc
 * Barcelona", not "FC Barcelona" — there's no reliable way to tell an acronym from a short word.
 */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return '';
  const letters = value.replace(/[^A-Za-z]/g, '');
  const isShouting = letters.length > 1 && letters === letters.toUpperCase();
  const isWhispering = letters.length > 1 && letters === letters.toLowerCase();
  if (!isShouting && !isWhispering) return value;
  return value.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase());
}
