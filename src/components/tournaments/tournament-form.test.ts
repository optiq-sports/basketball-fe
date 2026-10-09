import { describe, expect, it } from 'vitest';
import { EMPTY_TOURNAMENT_FORM, divisionLabel, fromTournament, toTournamentPayload, validateTournamentForm, type TournamentFormValues } from './tournament-form';

const filled: TournamentFormValues = {
  ...EMPTY_TOURNAMENT_FORM,
  name: '  Summer Cup ',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  venue: 'Main Arena',
  crewChief: 'J. Doe',
  umpire2: 'M. Lee',
};

describe('validateTournamentForm', () => {
  it('requires the fields the backend requires, and nothing else', () => {
    const errors = validateTournamentForm(EMPTY_TOURNAMENT_FORM);
    expect(Object.keys(errors).sort()).toEqual(['name', 'startDate', 'venue', 'crewChief', 'umpire2'].sort());
  });

  it('accepts a complete form', () => {
    expect(validateTournamentForm(filled)).toEqual({});
  });

  it('rejects a non-whole or zero number of games and quarter length', () => {
    expect(validateTournamentForm({ ...filled, numberOfGames: '0' }).numberOfGames).toMatch(/whole number/);
    expect(validateTournamentForm({ ...filled, quarterDuration: '10.5' }).quarterDuration).toMatch(/whole number/);
  });

  it('lets optional counts be left blank', () => {
    expect(validateTournamentForm({ ...filled, numberOfQuarters: '', overtimeDuration: '' })).toEqual({});
  });

  it('rejects an end date before the start date', () => {
    expect(validateTournamentForm({ ...filled, endDate: '2026-09-01' }).endDate).toMatch(/before the start date/);
  });
});

describe('toTournamentPayload', () => {
  it('trims text, converts numbers, and leaves out blank optional fields', () => {
    const body = toTournamentPayload(filled);
    expect(body).toEqual({
      name: 'Summer Cup',
      division: 'PREMIER',
      numberOfGames: 10,
      numberOfQuarters: 4,
      quarterDuration: 10,
      overtimeDuration: 5,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      venue: 'Main Arena',
      crewChief: 'J. Doe',
      umpire2: 'M. Lee',
    });
    expect(body).not.toHaveProperty('umpire1');
    expect(body).not.toHaveProperty('commissioner');
  });
});

describe('fromTournament', () => {
  it('pre-fills an edit from the saved record, trimming dates to the day', () => {
    const v = fromTournament({
      name: 'Summer Cup',
      division: 'DIVISION_1',
      numberOfGames: 12,
      numberOfQuarters: 4,
      quarterDuration: 10,
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T00:00:00.000Z',
      venue: 'Main Arena',
      crewChief: 'J. Doe',
      umpire2: 'M. Lee',
    });
    expect(v.startDate).toBe('2026-10-01');
    expect(v.numberOfGames).toBe('12');
    expect(v.overtimeDuration).toBe('');
  });
});

describe('divisionLabel', () => {
  it('labels known divisions and falls back to the raw value', () => {
    expect(divisionLabel('DIVISION_2')).toBe('Division 2');
    expect(divisionLabel('MYSTERY')).toBe('MYSTERY');
  });
});
