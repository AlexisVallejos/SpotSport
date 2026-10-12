import { describe, expect, it } from 'vitest';
import { createTracker, FRAMING, GET_READY, isSetDone, type Tracker } from './engine';
import { JOINTS, type Landmarks, type Point } from './geometry';
import { RULES } from './rules';

const FRAME = 33;
const blank = (): Landmarks => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));

function place(lm: Landmarks, joints: Partial<Record<keyof typeof JOINTS.left, Point>>) {
  for (const side of [JOINTS.left, JOINTS.right]) {
    for (const [name, point] of Object.entries(joints)) lm[side[name as keyof typeof side]] = { ...point, visibility: 0.99 };
  }
  return lm;
}

/** Side-view squat: vertical shin, knee bent kneeDeg, torso leaning leanDeg from vertical. */
function squat(kneeDeg: number, leanDeg = 10): Landmarks {
  const k = (kneeDeg * Math.PI) / 180;
  const l = (leanDeg * Math.PI) / 180;
  const ankle = { x: 0.5, y: 0.9 };
  const knee = { x: 0.5, y: 0.7 };
  const hip = { x: knee.x - 0.2 * Math.sin(k), y: knee.y + 0.2 * Math.cos(k) };
  const shoulder = { x: hip.x + 0.25 * Math.sin(l), y: hip.y - 0.25 * Math.cos(l) };
  return place(blank(), { ankle, knee, hip, shoulder });
}

/** Side-view plank; sag pushes the hip down (positive) or up (negative). */
function plank(sag = 0): Landmarks {
  return place(blank(), { shoulder: { x: 0.3, y: 0.5 }, hip: { x: 0.5, y: 0.5 + sag }, knee: { x: 0.65, y: 0.5 }, ankle: { x: 0.8, y: 0.5 } });
}

/** The same plank seen head-on: the body points at the camera, so it is "short" on screen. */
function plankFacing(): Landmarks {
  return place(blank(), { shoulder: { x: 0.5, y: 0.4 }, hip: { x: 0.5, y: 0.5 }, knee: { x: 0.5, y: 0.6 }, ankle: { x: 0.5, y: 0.7 } });
}

/** Drives a tracker with a clock, 30 frames per second. */
function session(rule = RULES.squat) {
  const tracker: Tracker = createTracker(rule);
  let now = 1000;
  const feed = (pose: Landmarks | null, ms: number) => {
    let state = tracker.update(pose, now);
    for (let t = FRAME; t < ms; t += FRAME) {
      now += FRAME;
      state = tracker.update(pose, now);
    }
    now += FRAME;
    return state;
  };
  /** Moves the knee angle smoothly from one value to another. */
  const ramp = (from: number, to: number, ms: number, lean = 10) => {
    let state = tracker.update(squat(from, lean), now);
    for (let t = FRAME; t <= ms; t += FRAME) {
      now += FRAME;
      state = tracker.update(squat(from + ((to - from) * t) / ms, lean), now);
    }
    now += FRAME;
    return state;
  };
  return { tracker, feed, ramp };
}

describe('createTracker (reps)', () => {
  it('asks to step back when the body is not visible', () => {
    const { tracker } = session();
    expect(tracker.update(null, 0)).toMatchObject({ status: 'framing', message: FRAMING });
    const hidden = squat(170);
    hidden[JOINTS.left.ankle].visibility = 0.1;
    hidden[JOINTS.right.ankle].visibility = 0.1;
    expect(tracker.update(hidden, 33).status).toBe('framing');
  });

  it('does not trust landmarks the camera only half sees', () => {
    const { tracker } = session();
    const unsure = squat(170);
    unsure[JOINTS.left.ankle].visibility = 0.55;
    unsure[JOINTS.right.ankle].visibility = 0.55;
    expect(tracker.update(unsure, 0).status).toBe('framing');
  });

  it('waits for the starting position before counting anything', () => {
    const { feed } = session();
    const state = feed(squat(170), 400);
    expect(state).toMatchObject({ ready: false, reps: 0, message: GET_READY });
    expect(feed(squat(170), 900).ready).toBe(true);
  });

  it('does not count sitting down and standing up as a squat', () => {
    const { feed, ramp } = session();
    feed(squat(92), 2000);
    const state = ramp(92, 172, 800);
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(0);
    expect(feed(squat(172), 300).reps).toBe(0);
  });

  it('counts a full squat', () => {
    const { feed, ramp } = session();
    feed(squat(172), 1200);
    ramp(172, 90, 900);
    feed(squat(90), 300);
    ramp(90, 172, 900);
    const state = feed(squat(172), 200);
    expect(state).toMatchObject({ status: 'active', ready: true, reps: 1, badReps: 0, tone: 'ok' });
  });

  it('flags a shallow squat', () => {
    const { feed, ramp } = session();
    feed(squat(172), 1200);
    ramp(172, 130, 800);
    ramp(130, 172, 800);
    const state = feed(squat(172), 200);
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(1);
    expect(state.message).toBe(RULES.squat.mode === 'reps' ? RULES.squat.shallow : '');
  });

  it('flags a squat with the chest collapsing', () => {
    const { feed, ramp } = session();
    feed(squat(172), 1200);
    ramp(172, 90, 900, 70);
    feed(squat(90, 70), 300);
    ramp(90, 172, 900, 70);
    const state = feed(squat(172), 200);
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(1);
    expect(state.errors['Mantené el pecho arriba.']).toBe(1);
  });

  it('ignores a single glitched frame', () => {
    const { tracker, feed } = session();
    feed(squat(172), 1500);
    tracker.update(squat(80), 5000);
    const state = feed(squat(172), 600);
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(0);
  });

  it('ignores a jolt that is too quick to be a repetition', () => {
    const { feed, ramp } = session();
    feed(squat(172), 1200);
    ramp(172, 90, 150);
    ramp(90, 172, 150);
    const state = feed(squat(172), 300);
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(0);
  });

  it('needs the starting position again after a reset', () => {
    const { tracker, feed, ramp } = session();
    feed(squat(172), 1200);
    ramp(172, 90, 900);
    ramp(90, 172, 900);
    tracker.reset();
    const state = feed(squat(172), 300);
    expect(state).toMatchObject({ reps: 0, ready: false });
  });
});

describe('createTracker (hold)', () => {
  it('needs a moment of good form, then only counts time while the plank is straight', () => {
    const { feed } = session(RULES.plank);
    const warmup = feed(plank(), 400);
    expect(warmup).toMatchObject({ ready: false, holdMs: 0, message: GET_READY });
    feed(plank(), 600);
    const counted = feed(plank(), 1000);
    expect(counted.ready).toBe(true);
    expect(counted.holdMs).toBeGreaterThan(800);
    const before = counted.holdMs;

    const sagging = feed(plank(0.08), 500);
    expect(sagging.holdMs).toBe(before);
    expect(sagging.message).toBe('Subí la cadera.');
    expect(sagging.errors['Subí la cadera.']).toBe(1);
  });

  it('has to earn the timer again after losing the form', () => {
    const { feed } = session(RULES.plank);
    feed(plank(), 2000);
    feed(plank(0.08), 300);
    const back = feed(plank(), 300);
    expect(back.ready).toBe(false);
    const earned = feed(plank(), 1500);
    expect(earned.ready).toBe(true);
  });

  it('does not count a body pointing at the camera', () => {
    const { feed } = session(RULES.plank);
    const state = feed(plankFacing(), 3000);
    expect(state.holdMs).toBe(0);
    expect(state.message).toBe('Ponete de costado a la cámara.');
  });

  it('knows when a set is done', () => {
    const { tracker } = session(RULES.plank);
    expect(isSetDone(RULES.plank, { ...tracker.update(plank(), 0), holdMs: 30_000 })).toBe(true);
    expect(isSetDone(RULES.squat, { ...tracker.update(plank(), 33), reps: 9 })).toBe(false);
  });
});
