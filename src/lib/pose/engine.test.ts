import { describe, expect, it } from 'vitest';
import { createTracker, FRAMING, isSetDone } from './engine';
import { JOINTS, type Landmarks, type Point } from './geometry';
import { RULES } from './rules';

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

function feed(tracker: ReturnType<typeof createTracker>, pose: Landmarks, frames = 8, start = 0) {
  let state = tracker.update(pose, start);
  for (let i = 1; i < frames; i += 1) state = tracker.update(pose, start + i * 33);
  return state;
}

describe('createTracker (reps)', () => {
  it('asks to step back when the body is not visible', () => {
    const tracker = createTracker(RULES.squat);
    expect(tracker.update(null, 0)).toMatchObject({ status: 'framing', message: FRAMING });
    const hidden = squat(170);
    hidden[JOINTS.left.ankle].visibility = 0.1;
    hidden[JOINTS.right.ankle].visibility = 0.1;
    expect(tracker.update(hidden, 33).status).toBe('framing');
  });

  it('counts a full squat', () => {
    const tracker = createTracker(RULES.squat);
    feed(tracker, squat(170));
    expect(feed(tracker, squat(90)).progress).toBe(1);
    const state = feed(tracker, squat(170));
    expect(state).toMatchObject({ status: 'active', reps: 1, badReps: 0, tone: 'ok' });
  });

  it('flags a shallow squat', () => {
    const tracker = createTracker(RULES.squat);
    feed(tracker, squat(170));
    feed(tracker, squat(130));
    const state = feed(tracker, squat(170));
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(1);
    expect(state.message).toBe(RULES.squat.mode === 'reps' ? RULES.squat.shallow : '');
  });

  it('flags a squat with the chest collapsing', () => {
    const tracker = createTracker(RULES.squat);
    feed(tracker, squat(170));
    const bottom = feed(tracker, squat(90, 70));
    expect(bottom.tone).toBe('warn');
    expect(bottom.failing.length).toBeGreaterThan(0);
    const state = feed(tracker, squat(170));
    expect(state.reps).toBe(0);
    expect(state.badReps).toBe(1);
    expect(state.errors['Mantené el pecho arriba.']).toBe(1);
  });

  it('starts over after reset', () => {
    const tracker = createTracker(RULES.squat);
    feed(tracker, squat(170));
    feed(tracker, squat(90));
    feed(tracker, squat(170));
    tracker.reset();
    expect(feed(tracker, squat(170)).reps).toBe(0);
  });
});

describe('createTracker (hold)', () => {
  it('only counts time while the plank is straight', () => {
    const tracker = createTracker(RULES.plank);
    const good = feed(tracker, plank(), 10, 0);
    expect(good.holdMs).toBe(9 * 33);
    expect(good.tone).toBe('ok');
    const sagging = feed(tracker, plank(0.08), 10, 1000);
    expect(sagging.holdMs).toBe(good.holdMs);
    expect(sagging.message).toBe('Subí la cadera.');
    expect(sagging.errors['Subí la cadera.']).toBe(1);
    expect(feed(tracker, plank(-0.08), 3, 2000).message).toBe('Bajá la cadera.');
  });

  it('knows when a set is done', () => {
    const tracker = createTracker(RULES.plank);
    expect(isSetDone(RULES.plank, { ...tracker.update(plank(), 0), holdMs: 30_000 })).toBe(true);
    expect(isSetDone(RULES.squat, { ...tracker.update(plank(), 33), reps: 9 })).toBe(false);
  });
});
