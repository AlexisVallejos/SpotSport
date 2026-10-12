// Demo 3D de cada ejercicio: un maniquí que hace la técnica correcta.
// Las poses se calculan con los mismos ángulos que mira el analizador (rules.ts), y un test exige que la demo
// pase todas sus reglas: lo que ves es exactamente lo que el sistema va a dar por bueno.
import type { Landmarks } from './geometry';
import { LM } from './geometry';
import type { RuleId } from './rules';

/** A point in the plane of the movement: x forward, y up, in meters. The figure faces +x. */
export type Pt = { x: number; y: number };
export type Limbs = { shoulder: Pt; elbow: Pt; wrist: Pt; hip: Pt; knee: Pt; ankle: Pt; toe: Pt };
/** `left` is the side nearest the camera; some exercises use the two legs differently (lunge, kick). */
export type Figure = { left: Limbs; right: Limbs; head: Pt };

const THIGH = 0.45;
const SHIN = 0.44;
const TORSO = 0.55;
const UPPER = 0.3;
const FORE = 0.27;
const BODY = THIGH + SHIN + TORSO;
const ANKLE_Y = 0.08;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: Pt, x: number, y: number): Pt => ({ x: a.x + x, y: a.y + y });

/** The point `length` away from `from`, `deg` clockwise from straight up (90 = forward, 180 = down, -90 = back). */
function polar(from: Pt, length: number, deg: number): Pt {
  return { x: from.x + length * Math.sin(rad(deg)), y: from.y + length * Math.cos(rad(deg)) };
}

/** The knee or elbow between `a` and `c` for two links of length l1, l2, bent toward `toward`. */
function bend(a: Pt, c: Pt, l1: number, l2: number, toward: Pt): Pt {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-6) || 1e-6;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / d;
  const uy = dy / d;
  const px = -uy;
  const py = ux;
  const sign = px * toward.x + py * toward.y >= 0 ? 1 : -1;
  return { x: a.x + ux * along + px * h * sign, y: a.y + uy * along + py * h * sign };
}

function limbs(shoulder: Pt, elbow: Pt, wrist: Pt, hip: Pt, knee: Pt, ankle: Pt, toe: Pt): Limbs {
  return { shoulder, elbow, wrist, hip, knee, ankle, toe };
}

/** Straight arm from the shoulder at `deg`, with a slight bend so it does not look locked. */
function armAt(shoulder: Pt, deg: number): { elbow: Pt; wrist: Pt } {
  const elbow = polar(shoulder, UPPER, deg);
  return { elbow, wrist: polar(elbow, FORE, deg) };
}

const headOver = (shoulder: Pt, deg: number): Pt => polar(shoulder, 0.22, deg);

function squat(p: number): Figure {
  const K = lerp(172, 92, p);
  const shin = (180 - K) * 0.28;
  const lean = lerp(8, 38, p);
  const ankle = { x: 0, y: ANKLE_Y };
  const knee = polar(ankle, SHIN, shin);
  const hip = polar(knee, THIGH, shin + 180 + K);
  const shoulder = polar(hip, TORSO, lean);
  const arm = armAt(shoulder, lerp(172, 85, p));
  const side = limbs(shoulder, arm.elbow, arm.wrist, hip, knee, ankle, add(ankle, 0.17, -ANKLE_Y));
  return { left: side, right: side, head: headOver(shoulder, lean) };
}

function lunge(p: number): Figure {
  const hipY = lerp(0.905, 0.68, p);
  const hip = { x: 0, y: hipY };
  const shoulder = polar(hip, TORSO, 4);
  const arm = armAt(shoulder, 176);
  const leg = (footX: number) => {
    const ankle = { x: footX, y: ANKLE_Y };
    return { ankle, knee: bend(hip, ankle, THIGH, SHIN, { x: 1, y: 0 }) };
  };
  const front = leg(0.32);
  const back = leg(-0.32);
  return {
    left: limbs(shoulder, arm.elbow, arm.wrist, hip, front.knee, front.ankle, add(front.ankle, 0.17, -ANKLE_Y)),
    right: limbs(shoulder, arm.elbow, arm.wrist, hip, back.knee, back.ankle, add(back.ankle, 0.17, -ANKLE_Y)),
    head: headOver(shoulder, 4),
  };
}

/** A body held straight from the ankles to the shoulders, which sit at `shoulder` height over the floor. */
function board(shoulder: Pt, elbow: Pt, wrist: Pt) {
  const rise = shoulder.y - ANKLE_Y;
  const ankle = { x: shoulder.x - Math.sqrt(BODY * BODY - rise * rise), y: ANKLE_Y };
  const at = (distance: number) => ({ x: ankle.x + ((shoulder.x - ankle.x) * distance) / BODY, y: ankle.y + ((shoulder.y - ankle.y) * distance) / BODY });
  const hip = at(THIGH + SHIN);
  const knee = at(SHIN);
  const toe = { x: ankle.x - 0.06, y: 0 };
  const forward = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const length = Math.hypot(forward.x, forward.y);
  const head = { x: shoulder.x + (forward.x / length) * 0.22, y: shoulder.y + (forward.y / length) * 0.22 + 0.03 };
  return { side: limbs(shoulder, elbow, wrist, hip, knee, ankle, toe), head };
}

function pushup(p: number): Figure {
  const H = lerp(0.6, 0.36, p);
  const shoulder = { x: 0, y: H };
  const wrist = { x: 0, y: 0.03 };
  const elbow = bend(shoulder, wrist, UPPER, FORE, { x: -1, y: 0.3 });
  const { side, head } = board(shoulder, elbow, wrist);
  return { left: side, right: side, head };
}

function plank(p: number): Figure {
  const breathe = 0.008 * Math.sin(p * Math.PI);
  const elbow = { x: 0, y: 0.03 };
  const shoulder = { x: 0, y: 0.33 + breathe };
  const { side, head } = board(shoulder, elbow, { x: 0.27, y: 0.03 });
  return { left: side, right: side, head };
}

function sidePlank(p: number): Figure {
  const breathe = 0.008 * Math.sin(p * Math.PI);
  const shoulder = { x: 0, y: 0.33 + breathe };
  const elbow = { x: 0, y: 0.03 };
  const { side, head } = board(shoulder, elbow, { x: 0.06, y: 0.03 });
  // The free arm reaches up to the ceiling.
  const free = armAt(shoulder, 8);
  return { left: side, right: { ...side, elbow: free.elbow, wrist: free.wrist }, head };
}

function bridge(p: number): Figure {
  const shoulder = { x: -0.9, y: ANKLE_Y };
  const phi = lerp(0, 26, p);
  const hip = { x: shoulder.x + TORSO * Math.cos(rad(phi)), y: shoulder.y + TORSO * Math.sin(rad(phi)) };
  const ankle = { x: 0, y: ANKLE_Y };
  const knee = bend(hip, ankle, THIGH, SHIN, { x: 0, y: 1 });
  const elbow = { x: shoulder.x + 0.3, y: 0.05 };
  const wrist = { x: shoulder.x + 0.57, y: 0.04 };
  const side = limbs(shoulder, elbow, wrist, hip, knee, ankle, add(ankle, 0.17, -ANKLE_Y));
  return { left: side, right: side, head: { x: shoulder.x - 0.21, y: 0.13 } };
}

function legRaise(p: number): Figure {
  const hip = { x: 0, y: 0.07 };
  const shoulder = { x: -TORSO, y: 0.07 };
  const theta = rad(lerp(0, 90, p));
  const along = (length: number): Pt => ({ x: hip.x + length * Math.cos(theta), y: hip.y + length * Math.sin(theta) });
  const knee = along(THIGH);
  const ankle = along(THIGH + SHIN);
  const toe = { x: ankle.x - 0.14 * Math.sin(theta), y: ankle.y + 0.14 * Math.cos(theta) };
  const elbow = { x: shoulder.x + 0.3, y: 0.05 };
  const wrist = { x: shoulder.x + 0.57, y: 0.04 };
  const side = limbs(shoulder, elbow, wrist, hip, knee, ankle, toe);
  return { left: side, right: side, head: { x: shoulder.x - 0.21, y: 0.12 } };
}

function kick(p: number): Figure {
  const wrist = { x: 0.5, y: 0.03 };
  const shoulder = { x: 0.5, y: 0.6 };
  const hip = { x: -0.05, y: 0.48 };
  const elbow = bend(shoulder, wrist, UPPER, FORE, { x: -1, y: 0 });
  // Support leg: knee on the floor under the hip, shin along the floor.
  const supportKnee = { x: hip.x, y: 0.03 };
  const supportAnkle = { x: hip.x - 0.44, y: 0.05 };
  const support = limbs(shoulder, elbow, wrist, hip, supportKnee, supportAnkle, { x: supportAnkle.x - 0.12, y: 0.03 });
  // Working leg: thigh swings back to hip height, shin points to the ceiling.
  const thigh = rad(lerp(-90, -188, p));
  const knee = { x: hip.x + THIGH * Math.cos(thigh), y: hip.y + THIGH * Math.sin(thigh) };
  const shin = rad(lerp(180, 90, p));
  const ankle = { x: knee.x + SHIN * Math.cos(shin), y: knee.y + SHIN * Math.sin(shin) };
  const toe = { x: ankle.x + 0.12 * Math.cos(shin + Math.PI / 2), y: Math.max(0, ankle.y + 0.12 * Math.sin(shin + Math.PI / 2)) };
  const working = limbs(shoulder, elbow, wrist, hip, knee, ankle, toe);
  return { left: working, right: support, head: { x: shoulder.x + 0.18, y: shoulder.y + 0.04 } };
}

const FIGURES: Record<RuleId, (p: number) => Figure> = { squat, lunge, pushup, plank, sidePlank, bridge, legRaise, kick };

/** The figure at `p` (0 = start position, 1 = deepest point of the repetition; holds barely move). */
export function figureAt(id: RuleId, p: number): Figure {
  return FIGURES[id](Math.min(1, Math.max(0, p)));
}

/** Smooth 0 → 1 → 0 loop for a phase in [0, 1). */
export function loop(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** The figure as the landmarks the analyzer reads, so the demo can be checked against the real rules. */
export function toLandmarks(figure: Figure): Landmarks {
  const lm: Landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const put = (index: number, point: Pt) => {
    lm[index] = { x: 0.5 + point.x * 0.3, y: 0.95 - point.y * 0.3, visibility: 1 };
  };
  const sides = [
    [figure.left, LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftHip, LM.leftKnee, LM.leftAnkle],
    [figure.right, LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightHip, LM.rightKnee, LM.rightAnkle],
  ] as const;
  for (const [side, shoulder, elbow, wrist, hip, knee, ankle] of sides) {
    put(shoulder, side.shoulder);
    put(elbow, side.elbow);
    put(wrist, side.wrist);
    put(hip, side.hip);
    put(knee, side.knee);
    put(ankle, side.ankle);
  }
  put(LM.nose, figure.head);
  return lm;
}

const CUES: Record<RuleId, { start: string; peak: string }> = {
  squat: { start: 'Arriba: pies al ancho de caderas, pecho alto.', peak: 'Abajo: muslos paralelos al piso, espalda recta.' },
  lunge: { start: 'Arriba: torso derecho, un paso largo.', peak: 'Abajo: las dos rodillas cerca de 90 grados.' },
  pushup: { start: 'Arriba: cuerpo en línea, brazos estirados.', peak: 'Abajo: pecho casi al piso, codos cerca del cuerpo.' },
  plank: { start: 'Cuerpo recto de la cabeza a los talones.', peak: 'No dejes caer la cadera: aguantá.' },
  sidePlank: { start: 'Codo bajo el hombro, cuerpo en línea.', peak: 'Cadera arriba, no la dejes caer.' },
  bridge: { start: 'Abajo: pies firmes, rodillas flexionadas.', peak: 'Arriba: cadera alineada con hombros y rodillas.' },
  legRaise: { start: 'Abajo: piernas estiradas, espalda baja pegada.', peak: 'Arriba: piernas casi a 90 grados, sin doblar rodillas.' },
  kick: { start: 'Abajo: manos bajo los hombros, rodillas bajo la cadera.', peak: 'Arriba: la pierna sube hasta la altura de la cadera.' },
};

export function cuesFor(id: RuleId) {
  return CUES[id];
}
