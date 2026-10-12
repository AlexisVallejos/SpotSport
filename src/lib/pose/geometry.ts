/** A landmark as MediaPipe returns it: x/y normalized 0–1, y grows downward. */
export type Point = { x: number; y: number; z?: number; visibility?: number };
export type Landmarks = Point[];

/** BlazePose landmark indices used by the rules. */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type Side = 'left' | 'right';
export type Joints = { shoulder: number; elbow: number; wrist: number; hip: number; knee: number; ankle: number };

export const JOINTS: Record<Side, Joints> = {
  left: { shoulder: LM.leftShoulder, elbow: LM.leftElbow, wrist: LM.leftWrist, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
  right: { shoulder: LM.rightShoulder, elbow: LM.rightElbow, wrist: LM.rightWrist, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
};

const DEGREES = 180 / Math.PI;

/** Angle at b formed by a–b–c, in degrees (0–180). */
export function angle(a: Point, b: Point, c: Point): number {
  const ax = a.x - b.x;
  const ay = a.y - b.y;
  const cx = c.x - b.x;
  const cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (length === 0) return 0;
  const cos = (ax * cx + ay * cy) / length;
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEGREES;
}

/** Degrees between the segment from→to and straight up: 0 = vertical, 90 = horizontal. */
export function inclination(from: Point, to: Point): number {
  return angle({ x: from.x, y: from.y - 1 }, from, to);
}

export function isVisible(lm: Landmarks, index: number, min = 0.5): boolean {
  const point = lm[index];
  return !!point && (point.visibility ?? 1) >= min;
}

/** The side of the body the camera sees better (for side-view exercises). */
export function bestSide(lm: Landmarks): Side {
  const score = (joints: Joints) => [joints.shoulder, joints.hip, joints.knee, joints.ankle].reduce((sum, index) => sum + (lm[index]?.visibility ?? 0), 0);
  return score(JOINTS.left) >= score(JOINTS.right) ? 'left' : 'right';
}

/** Whether p sits above the straight line from a to c (smaller y = higher on screen). */
export function isAboveLine(p: Point, a: Point, c: Point): boolean {
  const t = c.x === a.x ? 0.5 : (p.x - a.x) / (c.x - a.x);
  return p.y < a.y + (c.y - a.y) * t;
}
