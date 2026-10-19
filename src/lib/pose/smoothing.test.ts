import { describe, expect, it } from 'vitest';
import type { Landmarks } from './geometry';
import { createSmoother } from './smoothing';

const FRAME = 33;
const pose = (x: number, y: number, visibility = 0.99): Landmarks => Array.from({ length: 33 }, () => ({ x, y, z: 0, visibility }));

/** Deterministic ±amp noise, so the test does not depend on chance. */
const noise = (i: number, amp: number) => amp * Math.sin(i * 12.9898) * Math.cos(i * 4.1414);

describe('createSmoother', () => {
  it('removes the jitter of a person standing still', () => {
    const smoother = createSmoother();
    let rawSpread = 0;
    let smoothSpread = 0;
    for (let i = 0; i < 90; i += 1) {
      const x = 0.5 + noise(i, 0.006);
      const out = smoother.smooth(pose(x, 0.5), i * FRAME)!;
      if (i > 30) {
        rawSpread = Math.max(rawSpread, Math.abs(x - 0.5));
        smoothSpread = Math.max(smoothSpread, Math.abs(out[0].x - 0.5));
      }
    }
    expect(smoothSpread).toBeLessThan(rawSpread * 0.5);
  });

  it('follows a real movement with almost no lag', () => {
    const smoother = createSmoother();
    let out: Landmarks | null = null;
    // Half a squat: the hip drops 0.2 in half a second.
    for (let i = 0; i <= 15; i += 1) out = smoother.smooth(pose(0.5, 0.5 + (0.2 * i) / 15), i * FRAME);
    expect(out![0].y).toBeGreaterThan(0.66);
    for (let i = 16; i <= 25; i += 1) out = smoother.smooth(pose(0.5, 0.7), i * FRAME);
    expect(out![0].y).toBeCloseTo(0.7, 2);
  });

  it('does not let one doubtful frame switch a joint off', () => {
    const smoother = createSmoother();
    for (let i = 0; i < 10; i += 1) smoother.smooth(pose(0.5, 0.5, 0.95), i * FRAME);
    const out = smoother.smooth(pose(0.5, 0.5, 0.2), 10 * FRAME)!;
    expect(out[0].visibility).toBeGreaterThan(0.6);
  });

  it('starts over when the person disappears for a while', () => {
    const smoother = createSmoother();
    for (let i = 0; i < 10; i += 1) smoother.smooth(pose(0.2, 0.5), i * FRAME);
    expect(smoother.smooth(null, 400)).toBeNull();
    expect(smoother.smooth(null, 1200)).toBeNull();
    expect(smoother.smooth(pose(0.8, 0.5), 1233)![0].x).toBe(0.8);
  });

  it('takes an impossible jump as is (a new detection)', () => {
    const smoother = createSmoother();
    for (let i = 0; i < 10; i += 1) smoother.smooth(pose(0.2, 0.5), i * FRAME);
    expect(smoother.smooth(pose(0.7, 0.5), 10 * FRAME)![0].x).toBe(0.7);
  });
});
