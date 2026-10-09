import { isVisible, type Landmarks } from './geometry';
import type { PoseRule } from './rules';

export type Tone = 'ok' | 'warn' | 'info';

export type TrackerState = {
  status: 'framing' | 'active';
  reps: number;
  /** Reps that reached the bottom with bad form, or stopped halfway. */
  badReps: number;
  holdMs: number;
  /** 0–1: how far into the current rep (reps mode). */
  progress: number;
  message: string;
  tone: Tone;
  /** Landmarks to paint red right now. */
  failing: number[];
  /** How many times each correction was given. */
  errors: Record<string, number>;
};

export type Tracker = { update: (lm: Landmarks | null, now: number) => TrackerState; reset: () => void };

export const FRAMING = 'Alejate un poco: necesito verte de la cabeza a los pies.';

const SMOOTHING = 5;
const BAD_FRAMES = 3;
const REP_START = 0.25;
const REP_END = 0.1;
const PARTIAL = 0.35;
const MAX_STEP_MS = 200;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const bump = (errors: Record<string, number>, key: string) => ({ ...errors, [key]: (errors[key] ?? 0) + 1 });

function initial(rule: PoseRule): TrackerState {
  return { status: 'framing', reps: 0, badReps: 0, holdMs: 0, progress: 0, message: rule.mode === 'hold' ? 'Ponete en posición.' : 'Empezá cuando quieras.', tone: 'info', failing: [], errors: {} };
}

export function isSetDone(rule: PoseRule, state: TrackerState): boolean {
  return rule.mode === 'reps' ? state.reps >= rule.target : state.holdMs >= rule.target * 1000;
}

/** Turns a stream of landmarks into reps, hold time and corrections. Pure: no camera, no DOM. */
export function createTracker(rule: PoseRule): Tracker {
  let state = initial(rule);
  let recent: number[] = [];
  let moving = false;
  let deepest = 0;
  let faults: Record<string, number> = {};
  let last: number | null = null;
  let lastFault = '';

  function reset() {
    state = initial(rule);
    recent = [];
    moving = false;
    deepest = 0;
    faults = {};
    last = null;
    lastFault = '';
  }

  function update(lm: Landmarks | null, now: number): TrackerState {
    const step = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;

    if (!lm || !rule.required(lm).every((index) => isVisible(lm, index))) {
      recent = [];
      state = { ...state, status: 'framing', message: FRAMING, tone: 'warn', failing: [] };
      return state;
    }

    const failed = rule.checks.filter((check) => !check.ok(lm));
    const failing = [...new Set(failed.flatMap((check) => check.joints(lm)))];

    if (rule.mode === 'hold') {
      if (failed.length > 0) {
        const message = failed[0].message;
        const errors = message !== lastFault ? bump(state.errors, message) : state.errors;
        lastFault = message;
        state = { ...state, status: 'active', message, tone: 'warn', failing, errors };
      } else {
        lastFault = '';
        state = { ...state, status: 'active', holdMs: state.holdMs + step, message: '¡Bien! Mantené así.', tone: 'ok', failing: [] };
      }
      return state;
    }

    recent.push(rule.metric(lm));
    if (recent.length > SMOOTHING) recent.shift();
    const value = recent.reduce((sum, item) => sum + item, 0) / recent.length;
    const progress = clamp((rule.rest - value) / (rule.rest - rule.peak));
    let { reps, badReps, errors, message, tone } = state;

    if (moving) for (const check of failed) faults[check.message] = (faults[check.message] ?? 0) + 1;

    if (!moving && progress > REP_START) {
      moving = true;
      deepest = progress;
      faults = {};
    } else if (moving) {
      deepest = Math.max(deepest, progress);
      if (progress < REP_END) {
        moving = false;
        const fault = Object.keys(faults).find((key) => faults[key] >= BAD_FRAMES);
        if (deepest >= 1 && !fault) {
          reps += 1;
          message = `¡Bien! Van ${reps}.`;
          tone = 'ok';
        } else if (deepest >= 1 && fault) {
          badReps += 1;
          errors = bump(errors, fault);
          message = fault;
          tone = 'warn';
        } else if (deepest >= PARTIAL) {
          badReps += 1;
          errors = bump(errors, rule.shallow);
          message = rule.shallow;
          tone = 'warn';
        }
      }
    }

    if (moving && failed.length > 0) {
      message = failed[0].message;
      tone = 'warn';
    }

    state = { ...state, status: 'active', reps, badReps, errors, message, tone, progress, failing };
    return state;
  }

  return { update, reset };
}
