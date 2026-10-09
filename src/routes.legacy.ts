/**
 * Addresses from the retired Start New wizard. Its first page only created a tournament, which the New
 * tournament dialog does, and its other pages (/teams, /players, /team-overview, /complete) were never
 * reachable from it. These redirects keep old bookmarks and links working instead of landing on a blank
 * page.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/start-new', '/tournaments?new=1'],
  ['/teams', '/teams-management'],
  ['/players', '/players-management'],
  ['/team-overview', '/tournaments'],
  ['/complete', '/tournaments'],
];
