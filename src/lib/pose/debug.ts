import { bestSide, type Landmarks } from './geometry';
import type { PoseRule } from './rules';

export type Reading = {
  side: 'left' | 'right';
  /** Required landmarks the camera sees well enough. */
  visible: number;
  total: number;
  minVisibility: number;
  /** The angle the rep is measured on, and where rest and depth are. Null in holds. */
  metric: number | null;
  rest: number | null;
  peak: number | null;
  /** 0–1 like the engine computes it. */
  progress: number | null;
  checks: { message: string; ok: boolean }[];
};

/** What the analyzer is looking at right now, for calibrating thresholds against a real body and camera. */
export function measure(rule: PoseRule, lm: Landmarks): Reading {
  const required = rule.required(lm);
  const scores = required.map((index) => lm[index]?.visibility ?? 0);
  const reps = rule.mode === 'reps' ? rule : null;
  const metric = reps ? reps.metric(lm) : null;
  return {
    side: bestSide(lm),
    visible: scores.filter((score) => score >= 0.5).length,
    total: required.length,
    minVisibility: scores.length ? Math.min(...scores) : 0,
    metric,
    rest: reps?.rest ?? null,
    peak: reps?.peak ?? null,
    progress: reps && metric !== null ? Math.min(1, Math.max(0, (reps.rest - metric) / (reps.rest - reps.peak))) : null,
    checks: rule.checks.map((check) => ({ message: check.message, ok: check.ok(lm) })),
  };
}
