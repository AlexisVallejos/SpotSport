import { checkFraming, STEP_BACK } from './framing';
import { bestSide, isVisible, sideScore, type Landmarks, type Side } from './geometry';
import type { PoseRule } from './rules';

export type Tone = 'ok' | 'warn' | 'info';

/** One finished repetition: whether it counted and how long it took. */
export type RepMark = { ok: boolean; ms: number };

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
  /** Body parts the camera does not see well enough, while framing. */
  missing: string[];
  /** The side of the body being judged, locked so it does not flip mid-rep. */
  side: Side | null;
  /** Every repetition of the set, in order. */
  log: RepMark[];
};

export type Tracker = {
  update: (lm: Landmarks | null, now: number) => TrackerState;
  reset: () => void;
  /** Asks for the starting position again without losing the count (after a pause). */
  rearm: () => void;
};

export const FRAMING = STEP_BACK;
export const GET_READY = 'Ponete en posición de inicio y quedate quieto un segundo.';
export const GO = '¡Listo! Arrancá cuando quieras.';

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
/**
 * Once following a body, a lower bar keeps it: at the bottom of a squat the knees and ankles fold and their
 * visibility dips, exactly when the depth is decided.
 */
const KEEP_VISIBILITY = 0.4;
/** One frame cannot move an angle more than this: it is a detection glitch, not a person. */
const MAX_JUMP = 55;
/** A hand crossing in front of a knee for a moment does not lose the rep in progress. */
const LOST_GRACE_MS = 600;
/** The other side has to be seen this much better (0–4 scale), for this long, before the tracker switches to it. */
const SIDE_MARGIN = 0.5;
const SIDE_SWITCH_MS = 400;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const bump = (errors: Record<string, number>, key: string) => ({ ...errors, [key]: (errors[key] ?? 0) + 1 });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function initial(rule: PoseRule): TrackerState {
  return {
    status: 'framing',
    ready: false,
    reps: 0,
    badReps: 0,
    holdMs: 0,
    progress: 0,
    message: rule.mode === 'hold' ? 'Ponete en posición.' : 'Empezá cuando quieras.',
    tone: 'info',
    failing: [],
    errors: {},
    missing: [],
    side: null,
    log: [],
  };
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
  let lastSeen: number | null = null;
  let side: Side | null = null;
  let challengerSince: number | null = null;

  function rearm() {
    recent = [];
    lastRaw = null;
    armedAt = null;
    armed = false;
    moving = false;
    deepest = 0;
    faults = {};
    lastFault = '';
  }

  function reset() {
    rearm();
    state = initial(rule);
    last = null;
    lastSeen = null;
    side = null;
    challengerSince = null;
  }

  function lose(lm: Landmarks | null) {
    rearm();
    lastSeen = null;
    side = null;
    challengerSince = null;
    const framing = checkFraming(lm, lm ? rule.required(lm, bestSide(lm)) : [], MIN_VISIBILITY);
    state = { ...state, status: 'framing', ready: false, message: framing.message || FRAMING, tone: 'warn', failing: [], missing: framing.missing, side: null };
    return state;
  }

  /** Keeps judging the same side unless the other one is clearly better seen for a while. */
  function lockSide(lm: Landmarks, now: number): Side {
    if (!side) return (side = bestSide(lm));
    const other: Side = side === 'left' ? 'right' : 'left';
    if (sideScore(lm, other) - sideScore(lm, side) > SIDE_MARGIN) {
      challengerSince ??= now;
      if (now - challengerSince >= SIDE_SWITCH_MS) {
        side = other;
        challengerSince = null;
        // Angles from the other side are a different series: start the smoothing over.
        recent = [];
        lastRaw = null;
      }
    } else {
      challengerSince = null;
    }
    return side;
  }

  function update(lm: Landmarks | null, now: number): TrackerState {
    const step = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;

    const s = lm ? lockSide(lm, now) : null;
    const bar = state.status === 'active' ? KEEP_VISIBILITY : MIN_VISIBILITY;
    if (!lm || !s || !rule.required(lm, s).every((index) => isVisible(lm, index, bar))) {
      // A brief miss keeps everything as it was; nothing is judged until the body is back.
      if (state.status === 'active' && lastSeen !== null && now - lastSeen < LOST_GRACE_MS) return state;
      return lose(lm);
    }
    lastSeen = now;

    const failed = rule.checks.filter((check) => !check.ok(lm, s));
    const failing = [...new Set(failed.flatMap((check) => check.joints(lm, s)))];

    // ── Held positions ──
    if (rule.mode === 'hold') {
      if (failed.length > 0) {
        armedAt = null;
        const message = failed[0].message;
        const errors = armed && message !== lastFault ? bump(state.errors, message) : state.errors;
        lastFault = message;
        // Form lost: the timer stops and has to be earned again with a moment of good form.
        armed = false;
        state = { ...state, status: 'active', ready: false, message, tone: 'warn', failing, errors, missing: [], side: s };
        return state;
      }
      lastFault = '';
      if (!armed) {
        armedAt ??= now;
        if (now - armedAt < HOLD_ARM_MS) {
          state = { ...state, status: 'active', ready: false, message: GET_READY, tone: 'info', failing: [], missing: [], side: s };
          return state;
        }
        armed = true;
      }
      state = { ...state, status: 'active', ready: true, holdMs: state.holdMs + step, message: '¡Bien! Mantené así.', tone: 'ok', failing: [], missing: [], side: s };
      return state;
    }

    // ── Repetitions ──
    const raw = rule.metric(lm, s);
    if (lastRaw !== null && Math.abs(raw - lastRaw) > MAX_JUMP) {
      // A single frame far from the last one: wait for a second frame to agree before believing it.
      lastRaw = raw;
      return state;
    }
    lastRaw = raw;
    recent.push(raw);
    if (recent.length > SMOOTHING) recent.shift();
    const progress = clamp((rule.rest - median(recent)) / (rule.rest - rule.peak));
    let { reps, badReps, errors, message, tone, log } = state;

    if (!armed) {
      if (progress < REP_END && failed.length === 0) {
        armedAt ??= now;
        if (now - armedAt >= ARM_MS) armed = true;
      } else {
        armedAt = null;
      }
      if (!armed) {
        state = { ...state, status: 'active', ready: false, progress: 0, message: GET_READY, tone: 'info', failing, missing: [], side: s };
        return state;
      }
      // The "get ready" line would otherwise stay on screen through the whole first rep.
      message = GO;
      tone = 'info';
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
        const ms = now - moveStart;
        if (ms >= MIN_REP_MS) {
          const fault = Object.keys(faults).find((key) => faults[key] >= BAD_FRAMES);
          if (deepest >= 1 && !fault) {
            reps += 1;
            log = [...log, { ok: true, ms }];
            message = `¡Bien! Van ${reps}.`;
            tone = 'ok';
          } else if (deepest >= 1 && fault) {
            badReps += 1;
            log = [...log, { ok: false, ms }];
            errors = bump(errors, fault);
            message = fault;
            tone = 'warn';
          } else if (deepest >= PARTIAL) {
            badReps += 1;
            log = [...log, { ok: false, ms }];
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

    state = { ...state, status: 'active', ready: true, reps, badReps, errors, message, tone, progress, failing, missing: [], side: s, log };
    return state;
  }

  return { update, reset, rearm };
}
