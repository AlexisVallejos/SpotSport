import { describe, expect, it } from 'vitest';
import { angle, bestSide, inclination, isAboveLine, isVisible, JOINTS, type Landmarks } from './geometry';

const blank = (visibility = 0.1): Landmarks => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }));

describe('angle', () => {
  it('measures a right angle', () => {
    expect(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90);
  });
  it('measures a straight line', () => {
    expect(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180);
  });
  it('returns 0 when two points coincide', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });
});

describe('inclination', () => {
  it('is 0 for a segment pointing up', () => {
    expect(inclination({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.2 })).toBeCloseTo(0);
  });
  it('is 90 for a horizontal segment', () => {
    expect(inclination({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 })).toBeCloseTo(90);
  });
});

describe('isVisible', () => {
  it('uses the visibility score', () => {
    const lm = blank(0.2);
    lm[11] = { x: 0.5, y: 0.5, visibility: 0.9 };
    expect(isVisible(lm, 11)).toBe(true);
    expect(isVisible(lm, 12)).toBe(false);
    expect(isVisible(lm, 40)).toBe(false);
  });
});

describe('bestSide', () => {
  it('picks the side the camera sees better', () => {
    const lm = blank();
    for (const index of Object.values(JOINTS.right)) lm[index] = { x: 0.5, y: 0.5, visibility: 0.95 };
    expect(bestSide(lm)).toBe('right');
    for (const index of Object.values(JOINTS.left)) lm[index] = { x: 0.5, y: 0.5, visibility: 0.99 };
    expect(bestSide(lm)).toBe('left');
  });
});

describe('isAboveLine', () => {
  it('compares against the line between two points', () => {
    const a = { x: 0, y: 0.5 };
    const c = { x: 1, y: 0.5 };
    expect(isAboveLine({ x: 0.5, y: 0.4 }, a, c)).toBe(true);
    expect(isAboveLine({ x: 0.5, y: 0.6 }, a, c)).toBe(false);
  });
});
