import type { RepMark } from './engine';
import type { PoseRule, RuleId } from './rules';

// What a session is made of (sets, target, rest), chosen per exercise, and what was done in each one.
// Settings and history live in this browser only: they are conveniences, not records.

export type SessionConfig = { sets: number; target: number; restS: number };

type Range = { min: number; max: number; step: number };
export const LIMITS: Record<'sets' | 'reps' | 'hold' | 'rest', Range> = {
  sets: { min: 1, max: 5, step: 1 },
  reps: { min: 5, max: 30, step: 1 },
  hold: { min: 10, max: 90, step: 5 },
  rest: { min: 10, max: 90, step: 5 },
};

export const DEFAULT_SETS = 3;
export const DEFAULT_REST_S = 15;

const CONFIG_KEY = 'spot:entrenar:ajustes';
const HISTORY_KEY = 'spot:entrenar:historial';
const HISTORY_MAX = 60;
const DAY_MS = 86_400_000;

const fit = (value: number, { min, max, step }: Range) => Math.min(max, Math.max(min, Math.round(value / step) * step));
export const targetRange = (rule: PoseRule): Range => (rule.mode === 'reps' ? LIMITS.reps : LIMITS.hold);

export function defaultConfig(rule: PoseRule): SessionConfig {
  return { sets: DEFAULT_SETS, target: rule.target, restS: DEFAULT_REST_S };
}

/** Anything out of range (an old setting, a hand-edited storage) is brought back inside it. */
export function clampConfig(rule: PoseRule, config: Partial<SessionConfig>): SessionConfig {
  const base = defaultConfig(rule);
  const number = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return {
    sets: fit(number(config.sets, base.sets), LIMITS.sets),
    target: fit(number(config.target, base.target), targetRange(rule)),
    restS: fit(number(config.restS, base.restS), LIMITS.rest),
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin storage: dura hasta recargar.
  }
}

export function readConfig(rule: PoseRule): SessionConfig {
  const all = readJson<Partial<Record<RuleId, Partial<SessionConfig>>>>(CONFIG_KEY, {});
  return clampConfig(rule, all[rule.id] ?? {});
}

export function writeConfig(rule: PoseRule, config: SessionConfig) {
  const all = readJson<Partial<Record<RuleId, SessionConfig>>>(CONFIG_KEY, {});
  writeJson(CONFIG_KEY, { ...all, [rule.id]: clampConfig(rule, config) });
}

/** The rule with the target the person chose: the tracker and the coach read it from there. */
export const withTarget = (rule: PoseRule, target: number): PoseRule => ({ ...rule, target });

// ───────────────────────── results ─────────────────────────

export type SetResult = { reps: number; badReps: number; holdMs: number; log: RepMark[]; errors: Record<string, number> };
export type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

export function sumSets(sets: SetResult[]): Totals {
  const errors: Record<string, number> = {};
  for (const set of sets) for (const [key, count] of Object.entries(set.errors)) errors[key] = (errors[key] ?? 0) + count;
  return {
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    badReps: sets.reduce((sum, set) => sum + set.badReps, 0),
    holdMs: sets.reduce((sum, set) => sum + set.holdMs, 0),
    errors,
  };
}

/** Average time per good repetition, in ms; null without any. */
export function tempo(log: RepMark[]): number | null {
  const good = log.filter((mark) => mark.ok);
  return good.length ? good.reduce((sum, mark) => sum + mark.ms, 0) / good.length : null;
}

/** Share of the repetitions that counted, 0–1; null without any. */
export function quality(totals: Pick<Totals, 'reps' | 'badReps'>): number | null {
  const all = totals.reps + totals.badReps;
  return all ? totals.reps / all : null;
}

/** The correction given the most times, if any. */
export function worstError(errors: Record<string, number>): [string, number] | null {
  return Object.entries(errors).sort((a, b) => b[1] - a[1])[0] ?? null;
}

// ───────────────────────── history ─────────────────────────

export type SessionRecord = { at: number; exercise: string; rule: RuleId | null; sets: number; reps: number; badReps: number; holdMs: number };

export function readHistory(): SessionRecord[] {
  const list = readJson<unknown>(HISTORY_KEY, []);
  return Array.isArray(list) ? (list.filter((item) => item && typeof item.at === 'number' && typeof item.exercise === 'string') as SessionRecord[]) : [];
}

/** Newest first. Empty sessions (camera on, nothing done) are not worth keeping. */
export function saveSession(record: SessionRecord): SessionRecord[] {
  const history = readHistory();
  if (record.reps + record.badReps === 0 && record.holdMs < 1000) return history;
  const next = [record, ...history].slice(0, HISTORY_MAX);
  writeJson(HISTORY_KEY, next);
  return next;
}

const dayKey = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export type Activity = { week: number; weekReps: number; weekHoldMs: number; streak: number };

/** Last 7 days, and how many days in a row with a session (today, or up to yesterday if today has none yet). */
export function activity(history: SessionRecord[], now: number): Activity {
  const recent = history.filter((record) => now - record.at < 7 * DAY_MS && record.at <= now);
  const days = new Set(history.map((record) => dayKey(record.at)));
  let streak = 0;
  let day = new Date(now);
  day.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(day.getTime()))) day = new Date(day.getTime() - DAY_MS);
  while (days.has(dayKey(day.getTime()))) {
    streak += 1;
    day = new Date(day.getTime() - DAY_MS);
  }
  return {
    week: recent.length,
    weekReps: recent.reduce((sum, record) => sum + record.reps, 0),
    weekHoldMs: recent.reduce((sum, record) => sum + record.holdMs, 0),
    streak,
  };
}
