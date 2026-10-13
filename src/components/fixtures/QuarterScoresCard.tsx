import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/primitives/button';
import { Card, CardDescription, CardTitle } from '../ui/primitives/card';
import {
  QUARTERS,
  halfFilledQuarters,
  quarterScoresOf,
  quarterScoresSchema,
  toQuarterUpdate,
  type QuarterScoresValues,
} from './quarter-scores-form';
import type { Match, MatchUpdate } from '../../types/api';

const inputClass =
  'h-9 w-16 rounded-md border border-gray-300 bg-white px-2 text-center text-sm tabular-nums dark:border-gray-700 dark:bg-gray-900 dark:text-white';

/**
 * Enter or correct the score quarter by quarter. It was on the match page before the redesign and went
 * missing with it. It matters most when a finished game's score never reached the match record (Gap 47):
 * this is the one way to put it there by hand.
 */
export function QuarterScoresCard({ match, home, away, isSaving, onSave }: {
  match: Match;
  home: string;
  away: string;
  isSaving: boolean;
  onSave: (data: MatchUpdate) => void;
}) {
  const saved = quarterScoresOf(match);
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<QuarterScoresValues>({
    defaultValues: saved,
    resolver: zodResolver(quarterScoresSchema),
  });
  useEffect(() => { reset(quarterScoresOf(match)); }, [match, reset]);

  const half = halfFilledQuarters(watch());
  const bad = Object.values(errors)[0]?.message;

  return (
    <Card>
      <CardTitle>Quarter scores</CardTitle>
      <CardDescription>Enter or correct the score for each quarter. Both teams’ scores are needed for a quarter to save, and the final score is their total.</CardDescription>
      <form onSubmit={handleSubmit((v) => onSave(toQuarterUpdate(v)))} noValidate className="flex flex-col gap-3">
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Quarter scores</caption>
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th scope="col" className="py-1.5 text-left font-semibold">Team</th>
                {QUARTERS.map((q) => <th key={q} scope="col" className="py-1.5 text-center font-semibold">Q{q}</th>)}
              </tr>
            </thead>
            <tbody>
              {([['Home', home], ['Away', away]] as const).map(([side, name]) => (
                <tr key={side}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-gray-800 dark:text-gray-200">{name}</th>
                  {QUARTERS.map((q) => (
                    <td key={q} className="py-1.5 text-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        className={inputClass}
                        aria-label={`${name} quarter ${q}`}
                        aria-invalid={!!errors[`q${q}${side}`]}
                        {...register(`q${q}${side}`)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bad && <p role="alert" className="text-sm text-rose-600">{bad}</p>}
        {!bad && half.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">Quarter{half.length > 1 ? 's' : ''} {half.join(', ')} {half.length > 1 ? 'have' : 'has'} only one team’s score, so {half.length > 1 ? 'they' : 'it'} won’t be saved.</p>
        )}
        <div>
          <Button type="submit" disabled={!isDirty || isSaving}>{isSaving ? 'Saving…' : 'Save quarter scores'}</Button>
        </div>
      </form>
    </Card>
  );
}
