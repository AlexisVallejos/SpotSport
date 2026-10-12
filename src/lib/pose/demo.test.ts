import { describe, expect, it } from 'vitest';
import { cuesFor, figureAt, toLandmarks } from './demo';
import { isVisible } from './geometry';
import { RULES, type PoseRule, type RuleId } from './rules';

const ids = Object.keys(RULES) as RuleId[];

/** The same 0–1 progress the engine uses: 0 = at rest, 1 = at the deepest point of the rep. */
function progress(rule: PoseRule, p: number) {
  if (rule.mode !== 'reps') return 0;
  const lm = toLandmarks(figureAt(rule.id, p));
  return Math.min(1, Math.max(0, (rule.rest - rule.metric(lm)) / (rule.rest - rule.peak)));
}

describe('figureAt', () => {
  it.each(ids)('%s: the figure is fully visible to the analyzer', (id) => {
    const rule = RULES[id];
    for (const p of [0, 0.5, 1]) {
      const lm = toLandmarks(figureAt(id, p));
      for (const index of rule.required(lm)) expect(isVisible(lm, index), `${id} p=${p} #${index}`).toBe(true);
    }
  });

  it.each(ids)('%s: shows good form the whole way (every check passes)', (id) => {
    const rule = RULES[id];
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const lm = toLandmarks(figureAt(id, p));
      for (const check of rule.checks) expect(check.ok(lm), `${id} p=${p}: ${check.message}`).toBe(true);
    }
  });

  it.each(ids.filter((id) => RULES[id].mode === 'reps'))('%s: starts at rest and reaches full depth', (id) => {
    const rule = RULES[id];
    expect(progress(rule, 0)).toBeLessThan(0.05);
    expect(progress(rule, 1)).toBe(1);
  });

  it.each(ids.filter((id) => RULES[id].mode === 'reps'))('%s: moves steadily between rest and depth', (id) => {
    const rule = RULES[id];
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const now = progress(rule, Math.min(1, p));
      expect(now).toBeGreaterThanOrEqual(last - 1e-9);
      last = now;
    }
  });

  it('keeps feet on the floor: nothing goes below it', () => {
    for (const id of ids) {
      for (const p of [0, 0.5, 1]) {
        const figure = figureAt(id, p);
        for (const side of [figure.left, figure.right]) {
          for (const [name, point] of Object.entries(side)) expect(point.y, `${id} p=${p} ${name}`).toBeGreaterThanOrEqual(-0.001);
        }
      }
    }
  });

  it('keeps the limbs the same length while moving', () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    for (const id of ids) {
      const lengths = [0, 0.4, 1].map((p) => {
        const { left } = figureAt(id, p);
        return [dist(left.hip, left.knee), dist(left.knee, left.ankle), dist(left.shoulder, left.elbow), dist(left.elbow, left.wrist)];
      });
      for (let i = 0; i < 4; i += 1) expect(lengths[2][i], `${id} segment ${i}`).toBeCloseTo(lengths[0][i], 1);
    }
  });
});

describe('cuesFor', () => {
  it('has a short cue for every exercise', () => {
    for (const id of ids) {
      const cues = cuesFor(id);
      expect(cues.start.length).toBeGreaterThan(5);
      expect(cues.peak.length).toBeGreaterThan(5);
    }
  });
});
