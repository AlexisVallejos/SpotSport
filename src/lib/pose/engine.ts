import { isVisible, type Landmarks } from './geometry';
import type { PoseRule } from './rules';

export type Tone = 'ok' | 'warn' | 'info';

export type TrackerState = {
  status: 'framing' | 'active';
  /** False until the person has held the starting position for a moment: nothing counts before that. */
  ready: boolean;
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
export const GET_READY = 'Ponete en posición de inicio y quedate quieto un segundo.';

const SMOOTHING = 5;
const BAD_FRAMES = 3;
const REP_START = 0.25;
const REP_END = 0.1;
const PARTIAL = 0.35;
const MAX_STEP_MS = 200;
/** Time holding the starting position before reps start to count (so sitting down or walking in does not count). */
const ARM_MS = 1000;
const HOLD_ARM_MS = 800;
/** A real repetition takes more than this; faster than that is noise or a jolt. */
const MIN_REP_MS = 600;
/** Landmarks must be seen this well to be trusted: a guessed ankle gives wild angles. */
const MIN_VISIBILITY = 0.6;
/** One frame cannot move an angle more than this: it is a detection glitch, not a person. */
const MAX_JUMP = 55;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const bump = (errors: Record<string, number>, key: string) => ({ ...errors, [key]: (errors[key] ?? 0) + 1 });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function initial(rule: PoseRule): TrackerState {
  return { status: 'framing', ready: false, reps: 0, badReps: 0, holdMs: 0, progress: 0, message: rule.mode === 'hold' ? 'Ponete en posición.' : 'Empezá cuando quieras.', tone: 'info', failing: [], errors: {} };
}

export function isSetDone(rule: PoseRule, state: TrackerState): boolean {
  return rule.mode === 'reps' ? state.reps >= rule.target : state.holdMs >= rule.target * 1000;
}

/** Turns a stream of landmarks into reps, hold time and corrections. Pure: no camera, no DOM. */
export function createTracker(rule: PoseRule): Tracker {
  let state = initial(rule);
  let recent: number[] = [];
  let lastRaw: number | null = null;
  let armedAt: number | null = null;
  let armed = false;
  let moving = false;
  let moveStart = 0;
  let deepest = 0;
  let faults: Record<string, number> = {};
  let last: number | null = null;
  let lastFault = '';

  function reset() {
    state = initial(rule);
    recent = [];
    lastRaw = null;
    armedAt = null;
    armed = false;
    moving = false;
    deepest = 0;
    faults = {};
    last = null;
    lastFault = '';
  }

  function lose(message: string) {
    recent = [];
    lastRaw = null;
    armedAt = null;
    armed = false;
    moving = false;
    state = { ...state, status: 'framing', ready: false, message, tone: 'warn', failing: [] };
    return state;
  }

  function update(lm: Landmarks | null, now: number): TrackerState {
    const step = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;

    if (!lm || !rule.required(lm).every((index) => isVisible(lm, index, MIN_VISIBILITY))) return lose(FRAMING);

    const failed = rule.checks.filter((check) => !check.ok(lm));
    const failing = [...new Set(failed.flatMap((check) => check.joints(lm)))];

    // ── Held positions ──
    if (rule.mode === 'hold') {
      if (failed.length > 0) {
        armedAt = null;
        const message = failed[0].message;
        const errors = armed && message !== lastFault ? bump(state.errors, message) : state.errors;
        lastFault = message;
        // Form lost: the timer stops and has to be earned again with a moment of good form.
        armed = false;
        state = { ...state, status: 'active', ready: false, message, tone: 'warn', failing, errors };
        return state;
      }
      lastFault = '';
      if (!armed) {
        armedAt ??= now;
        if (now - armedAt < HOLD_ARM_MS) {
          state = { ...state, status: 'active', ready: false, message: GET_READY, tone: 'info', failing: [] };
          return state;
        }
        armed = true;
      }
      state = { ...state, status: 'active', ready: true, holdMs: state.holdMs + step, message: '¡Bien! Mantené así.', tone: 'ok', failing: [] };
      return state;
    }

    // ── Repetitions ──
    const raw = rule.metric(lm);
    if (lastRaw !== null && Math.abs(raw - lastRaw) > MAX_JUMP) {
      // A single frame far from the last one: wait for a second frame to agree before believing it.
      lastRaw = raw;
      return state;
    }
    lastRaw = raw;
    recent.push(raw);
    if (recent.length > SMOOTHING) recent.shift();
    const progress = clamp((rule.rest - median(recent)) / (rule.rest - rule.peak));
    let { reps, badReps, errors, message, tone } = state;

    if (!armed) {
      if (progress < REP_END && failed.length === 0) {
        armedAt ??= now;
        if (now - armedAt >= ARM_MS) armed = true;
      } else {
        armedAt = null;
      }
      if (!armed) {
        state = { ...state, status: 'active', ready: false, progress: 0, message: GET_READY, tone: 'info', failing };
        return state;
      }
    }

    if (moving) for (const check of failed) faults[check.message] = (faults[check.message] ?? 0) + 1;

    if (!moving && progress > REP_START) {
      moving = true;
      moveStart = now;
      deepest = progress;
      faults = {};
    } else if (moving) {
      deepest = Math.max(deepest, progress);
      if (progress < REP_END) {
        moving = false;
        if (now - moveStart >= MIN_REP_MS) {
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
    }

    if (moving && failed.length > 0) {
      message = failed[0].message;
      tone = 'warn';
    }

    state = { ...state, status: 'active', ready: true, reps, badReps, errors, message, tone, progress, failing };
    return state;
  }

  return { update, reset };
}
