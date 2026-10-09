import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

export interface BoxScoreRow {
  playerId: string;
  name: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fouls: number;
  turnovers: number;
  /** Advanced fields (Backend Gap #28). Their columns appear only when the backend sends them. */
  secondsPlayed?: number | null;
  fga?: number;
  fgm?: number;
  twoPa?: number;
  twoPm?: number;
  threePa?: number;
  threePm?: number;
  fta?: number;
  ftm?: number;
  oreb?: number;
  dreb?: number;
  plusMinus?: number | null;
  eff?: number | null;
}

type ColumnKey =
  | 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'fouls' | 'turnovers'
  | 'secondsPlayed' | 'fg' | 'twoPt' | 'threePt' | 'ft' | 'oreb' | 'dreb' | 'plusMinus' | 'eff';

interface Column {
  key: ColumnKey;
  label: string;
  title: string;
  /** Whether a team total is meaningful. Minutes and plus/minus aren't summed (stats reference). */
  summed: boolean;
  /** Whether the column has data for this set of rows. */
  present: (rows: BoxScoreRow[]) => boolean;
  value: (r: BoxScoreRow) => string;
  total: (rows: BoxScoreRow[]) => string;
}

const anyNumber = (rows: BoxScoreRow[], pick: (r: BoxScoreRow) => unknown) =>
  rows.some((r) => pick(r) !== undefined && pick(r) !== null);
const sum = (rows: BoxScoreRow[], pick: (r: BoxScoreRow) => number | undefined) =>
  rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
/** 50, 28.6 and 80, never 50.0: one decimal at most, and none when it is a whole number. */
export function percent(made: number, attempted: number): string {
  const v = Math.round((made / attempted) * 1000) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** `5/10 (50%)` as the stats reference shows shooting. No attempts is just `0/0`, with no percentage to give. */
export function shotLine(made: number, attempted: number): string {
  return attempted > 0 ? `${made}/${attempted} (${percent(made, attempted)}%)` : `${made}/${attempted}`;
}

const made = (m?: number, a?: number) => (a === undefined ? '—' : shotLine(m ?? 0, a));

const COUNT = (
  key: ColumnKey,
  label: string,
  title: string,
  pick: (r: BoxScoreRow) => number,
  present: (rows: BoxScoreRow[]) => boolean = () => true,
): Column => ({
  key,
  label,
  title,
  summed: true,
  present,
  value: (r) => String(pick(r)),
  total: (rows) => String(rows.reduce((s, r) => s + pick(r), 0)),
});

const SHOOTING = (
  key: ColumnKey,
  label: string,
  title: string,
  m: (r: BoxScoreRow) => number | undefined,
  a: (r: BoxScoreRow) => number | undefined,
): Column => ({
  key,
  label,
  title,
  summed: true,
  present: (rows) => anyNumber(rows, a),
  value: (r) => made(m(r), a(r)),
  total: (rows) => {
    const att = sum(rows, a);
    return att ? shotLine(sum(rows, m), att) : '—';
  },
});

const MIN: Column = {
  key: 'secondsPlayed',
  label: 'MIN',
  title: 'Minutes played',
  summed: false,
  present: (rows) => anyNumber(rows, (r) => r.secondsPlayed),
  // Whole minutes, as the reference specifies: 1,470 seconds is 24, not 24.5.
  value: (r) => (r.secondsPlayed == null ? '—' : String(Math.floor(r.secondsPlayed / 60))),
  total: () => '—',
};

const PLUS_MINUS: Column = {
  key: 'plusMinus',
  label: '+/-',
  title: 'Plus/minus while on court',
  summed: false,
  present: (rows) => anyNumber(rows, (r) => r.plusMinus),
  value: (r) => (r.plusMinus == null ? '—' : r.plusMinus > 0 ? `+${r.plusMinus}` : String(r.plusMinus)),
  total: () => '—',
};

const EFF: Column = {
  key: 'eff',
  label: 'EFF',
  title: 'Efficiency',
  summed: true,
  present: (rows) => anyNumber(rows, (r) => r.eff),
  value: (r) => (r.eff == null ? '—' : String(r.eff)),
  total: (rows) => String(sum(rows, (r) => r.eff ?? undefined)),
};

/**
 * In the order of the StatDash stats reference: MIN first (between the player and PTS), then PTS, the
 * shooting lines, rebounds with their split, AST, STL, BLK, PF, TO, +/- and EFF. A column is shown only when
 * the backend sends data for it (Gap 28), so today most of the advanced ones are absent.
 */
const COLUMNS: Column[] = [
  MIN,
  COUNT('points', 'PTS', 'Points', (r) => r.points),
  SHOOTING('fg', 'FG', 'Field goals made / attempted', (r) => r.fgm, (r) => r.fga),
  SHOOTING('twoPt', '2PT', 'Two-point field goals made / attempted', (r) => r.twoPm, (r) => r.twoPa),
  SHOOTING('threePt', '3PT', 'Three-point field goals made / attempted', (r) => r.threePm, (r) => r.threePa),
  SHOOTING('ft', 'FT', 'Free throws made / attempted', (r) => r.ftm, (r) => r.fta),
  COUNT('rebounds', 'REB', 'Rebounds', (r) => r.rebounds),
  COUNT('oreb', 'OREB', 'Offensive rebounds', (r) => r.oreb ?? 0, (rows) => anyNumber(rows, (r) => r.oreb)),
  COUNT('dreb', 'DREB', 'Defensive rebounds', (r) => r.dreb ?? 0, (rows) => anyNumber(rows, (r) => r.dreb)),
  COUNT('assists', 'AST', 'Assists', (r) => r.assists),
  COUNT('steals', 'STL', 'Steals', (r) => r.steals),
  COUNT('blocks', 'BLK', 'Blocks', (r) => r.blocks),
  COUNT('fouls', 'PF', 'Personal fouls', (r) => r.fouls),
  COUNT('turnovers', 'TO', 'Turnovers', (r) => r.turnovers),
  PLUS_MINUS,
  EFF,
];

/**
 * One team's box score. Team totals are summed from the rows, so a row and the total can't disagree.
 * Columns the backend doesn't send yet are left out rather than shown empty.
 */
export function BoxScoreTable({
  teamName,
  rows,
  caption,
  playerHref,
}: {
  teamName: string;
  rows: BoxScoreRow[];
  caption: string;
  /** Makes each player's name a link. Left out where there's nowhere for it to go (the client portal). */
  playerHref?: (playerId: string) => string;
}) {
  const columns = useMemo(() => COLUMNS.filter((c) => c.present(rows)), [rows]);

  const defs = useMemo<ColumnDef<BoxScoreRow>[]>(
    () => [
      {
        id: 'player',
        header: 'Player',
        cell: ({ row }) =>
          playerHref ? (
            <Link
              to={playerHref(row.original.playerId)}
              className="rounded font-medium text-gray-900 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-court-400/50 dark:text-white"
            >
              {row.original.name}
            </Link>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
          ),
      },
      ...columns.map<ColumnDef<BoxScoreRow>>((c) => ({
        id: c.key,
        header: () => <abbr title={c.title} className="no-underline">{c.label}</abbr>,
        cell: ({ row }) => c.value(row.original),
      })),
    ],
    [columns, playerHref],
  );

  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="px-4 pt-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
          {teamName} <span className="font-normal text-gray-500">— {caption}</span>
        </caption>
        <thead className="text-xs uppercase tracking-wide text-gray-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-800">
              {hg.headers.map((h) => (
                <th key={h.id} scope="col" className={`px-3 py-2.5 font-semibold ${h.id === 'player' ? 'text-left' : 'text-right tabular-nums'}`}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-gray-500">
                No players recorded for this team.
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-3 py-2.5 ${cell.column.id === 'player' ? 'text-left' : 'text-right tabular-nums text-gray-700 dark:text-gray-300'}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-gray-50 font-semibold dark:bg-gray-800/60">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-left text-gray-900 dark:text-white">Team</th>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">
                  {c.summed ? c.total(rows) : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
