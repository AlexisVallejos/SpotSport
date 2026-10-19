import { beforeEach, describe, expect, it } from 'vitest';
import { RULES } from './rules';
import { activity, clampConfig, quality, readConfig, readHistory, saveSession, sumSets, tempo, worstError, writeConfig, type SessionRecord } from './session';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) },
  configurable: true,
});

const DAY = 86_400_000;
const NOON = new Date(2026, 9, 19, 12).getTime();
const record = (at: number, reps = 10): SessionRecord => ({ at, exercise: 'Sentadilla', rule: 'squat', sets: 3, reps, badReps: 0, holdMs: 0 });

beforeEach(() => store.clear());

describe('session settings', () => {
  it('starts from the rule target and keeps what the person chose, per exercise', () => {
    expect(readConfig(RULES.squat)).toEqual({ sets: 3, target: 10, restS: 15 });
    writeConfig(RULES.squat, { sets: 4, target: 15, restS: 30 });
    expect(readConfig(RULES.squat)).toEqual({ sets: 4, target: 15, restS: 30 });
    expect(readConfig(RULES.plank)).toEqual({ sets: 3, target: 30, restS: 15 });
  });

  it('brings anything out of range back inside it', () => {
    expect(clampConfig(RULES.squat, { sets: 12, target: 2, restS: 600 })).toEqual({ sets: 5, target: 5, restS: 90 });
    expect(clampConfig(RULES.plank, { target: 33 })).toMatchObject({ target: 35 });
  });
});

describe('results', () => {
  it('adds up the sets', () => {
    const totals = sumSets([
      { reps: 8, badReps: 2, holdMs: 0, log: [], errors: { 'Bajá más.': 2 } },
      { reps: 10, badReps: 1, holdMs: 0, log: [], errors: { 'Bajá más.': 1, 'Pecho arriba.': 1 } },
    ]);
    expect(totals).toEqual({ reps: 18, badReps: 3, holdMs: 0, errors: { 'Bajá más.': 3, 'Pecho arriba.': 1 } });
    expect(worstError(totals.errors)).toEqual(['Bajá más.', 3]);
    expect(quality(totals)).toBeCloseTo(18 / 21);
  });

  it('averages the time of the good repetitions only', () => {
    expect(tempo([{ ok: true, ms: 2000 }, { ok: false, ms: 500 }, { ok: true, ms: 3000 }])).toBe(2500);
    expect(tempo([])).toBeNull();
  });
});

describe('history', () => {
  it('keeps sessions newest first and skips empty ones', () => {
    saveSession(record(NOON - DAY));
    saveSession(record(NOON));
    saveSession({ ...record(NOON + 1000), reps: 0 });
    expect(readHistory().map((item) => item.at)).toEqual([NOON, NOON - DAY]);
  });

  it('counts the week and the streak of days in a row', () => {
    const history = [record(NOON), record(NOON - DAY), record(NOON - 2 * DAY, 5), record(NOON - 4 * DAY), record(NOON - 9 * DAY)];
    expect(activity(history, NOON + 1000)).toEqual({ week: 4, weekReps: 35, weekHoldMs: 0, streak: 3 });
  });

  it('keeps the streak alive until the day is over', () => {
    expect(activity([record(NOON - DAY), record(NOON - 2 * DAY)], NOON).streak).toBe(2);
    expect(activity([record(NOON - 2 * DAY)], NOON).streak).toBe(0);
  });
});
