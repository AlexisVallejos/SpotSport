import { angle, bestSide, inclination, isAboveLine, JOINTS, type Joints, type Landmarks, type Side } from './geometry';

export type RuleId = 'squat' | 'lunge' | 'pushup' | 'plank' | 'sidePlank' | 'bridge' | 'legRaise' | 'kick';

/**
 * Every rule function takes the side of the body to judge. The tracker locks it so it does not flip between
 * frames mid-rep; without it, the side the camera sees better right now is used.
 */
export type Check = {
  message: string;
  /** Landmarks painted red while the check fails. */
  joints: (lm: Landmarks, side?: Side) => number[];
  ok: (lm: Landmarks, side?: Side) => boolean;
};

type BaseRule = {
  id: RuleId;
  name: string;
  view: 'side' | 'front';
  /** How to place the camera, shown before turning it on. */
  setup: string;
  /** Landmarks that must be visible before anything is judged. */
  required: (lm: Landmarks, side?: Side) => number[];
  checks: Check[];
};

/** The three landmarks of an angle: the vertex is the middle one. */
export type Triple = [number, number, number];

/** A rep goes from `rest` to `peak` on `metric` (degrees) and back. `measured` is the angle, drawn live on the body. */
export type RepRule = BaseRule & {
  mode: 'reps';
  target: number;
  measured: (lm: Landmarks, side?: Side) => Triple;
  metric: (lm: Landmarks, side?: Side) => number;
  rest: number;
  peak: number;
  shallow: string;
};
/** A hold accumulates `target` seconds with every check passing. */
export type HoldRule = BaseRule & { mode: 'hold'; target: number };
export type PoseRule = RepRule | HoldRule;

const pick = (lm: Landmarks, s?: Side): Joints => JOINTS[s ?? bestSide(lm)];
const at = (lm: Landmarks, [a, b, c]: Triple) => angle(lm[a], lm[b], lm[c]);
const knee = (lm: Landmarks, j: Joints) => angle(lm[j.hip], lm[j.knee], lm[j.ankle]);
const hip = (lm: Landmarks, j: Joints) => angle(lm[j.shoulder], lm[j.hip], lm[j.knee]);
const torso = (lm: Landmarks, s?: Side) => {
  const j = pick(lm, s);
  return inclination(lm[j.hip], lm[j.shoulder]);
};
/** Shoulder–hip–ankle: 180 when the body is a straight board. */
const bodyLine = (lm: Landmarks, s?: Side) => {
  const j = pick(lm, s);
  return angle(lm[j.shoulder], lm[j.hip], lm[j.ankle]);
};
const hipAbove = (lm: Landmarks, s?: Side) => {
  const j = pick(lm, s);
  return isAboveLine(lm[j.hip], lm[j.shoulder], lm[j.ankle]);
};
const lying = (lm: Landmarks, s?: Side) => {
  const j = pick(lm, s);
  return inclination(lm[j.ankle], lm[j.shoulder]) > 55;
};
const chain = (...names: (keyof Joints)[]) => (lm: Landmarks, s?: Side) => {
  const j = pick(lm, s);
  return names.map((name) => j[name]);
};
const triple = (a: keyof Joints, b: keyof Joints, c: keyof Joints) => (lm: Landmarks, s?: Side): Triple => {
  const j = pick(lm, s);
  return [j[a], j[b], j[c]];
};

/** Rep rules measure one angle; `metric` is always that angle, so what is drawn is what is counted. */
const reps = (rule: Omit<RepRule, 'mode' | 'metric'>): RepRule => ({ ...rule, mode: 'reps', metric: (lm, s) => at(lm, rule.measured(lm, s)) });

/** The torso must show its side to the camera: seen head-on, a body looks short and every angle lies. */
const PROFILE = 'Ponete de costado a la cámara.';
const profile = (min: number, a: keyof Joints, b: keyof Joints): Check => ({
  message: PROFILE,
  joints: () => [],
  ok: (lm, s) => {
    const j = pick(lm, s);
    return Math.abs(lm[j[a]].x - lm[j[b]].x) >= min;
  },
});

const board = (sag: string, pike: string): Check[] => [
  profile(0.2, 'shoulder', 'ankle'),
  { message: 'Ponete en posición: cuerpo horizontal.', joints: () => [], ok: lying },
  { message: sag, joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) >= 160 || hipAbove(lm, s) },
  { message: pike, joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) >= 160 || !hipAbove(lm, s) },
];

export const RULES: Record<RuleId, PoseRule> = {
  squat: reps({
    id: 'squat',
    name: 'Sentadilla',
    view: 'side',
    target: 10,
    setup: 'Ponete de costado a la cámara, a 2–3 metros, que se te vea de la cabeza a los pies.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    measured: triple('hip', 'knee', 'ankle'),
    rest: 160,
    peak: 100,
    shallow: 'Bajá más: muslos paralelos al piso.',
    checks: [{ message: 'Mantené el pecho arriba.', joints: chain('shoulder', 'hip'), ok: (lm, s) => torso(lm, s) < 50 }],
  }),
  lunge: reps({
    id: 'lunge',
    name: 'Estocada',
    view: 'side',
    target: 10,
    setup: 'De costado a la cámara, con lugar para dar un paso largo hacia adelante.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    // Both legs bend: the one bent the most is the one that tells the depth.
    measured: (lm) => {
      const j = knee(lm, JOINTS.left) <= knee(lm, JOINTS.right) ? JOINTS.left : JOINTS.right;
      return [j.hip, j.knee, j.ankle];
    },
    rest: 160,
    peak: 105,
    shallow: 'Bajá más: la rodilla de atrás cerca del piso.',
    checks: [{ message: 'Torso erguido.', joints: chain('shoulder', 'hip'), ok: (lm, s) => torso(lm, s) < 30 }],
  }),
  pushup: reps({
    id: 'pushup',
    name: 'Flexión de brazos',
    view: 'side',
    target: 10,
    setup: 'Cámara al costado y a la altura del piso, que se vea el cuerpo entero.',
    required: chain('shoulder', 'elbow', 'wrist', 'hip', 'ankle'),
    measured: triple('shoulder', 'elbow', 'wrist'),
    rest: 155,
    peak: 95,
    shallow: 'Bajá el pecho más cerca del piso.',
    checks: [profile(0.2, 'shoulder', 'ankle'), { message: 'Cuerpo recto: alineá la cadera.', joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) > 150 }],
  }),
  plank: {
    id: 'plank',
    name: 'Plancha',
    mode: 'hold',
    view: 'side',
    target: 30,
    setup: 'Cámara al costado y a la altura del piso. Apoyá antebrazos y puntas de los pies.',
    required: chain('shoulder', 'hip', 'ankle'),
    checks: board('Subí la cadera.', 'Bajá la cadera.'),
  },
  sidePlank: {
    id: 'sidePlank',
    name: 'Plancha lateral',
    mode: 'hold',
    view: 'front',
    target: 30,
    setup: 'Mirando a la cámara, apoyado en un antebrazo, con el cuerpo cruzando la pantalla.',
    required: chain('shoulder', 'hip', 'ankle'),
    checks: board('No dejes caer la cadera.', 'Bajá un poco la cadera.'),
  },
  bridge: reps({
    id: 'bridge',
    name: 'Puente de glúteo',
    view: 'side',
    target: 12,
    setup: 'Acostate boca arriba de costado a la cámara, rodillas flexionadas y pies apoyados.',
    required: chain('shoulder', 'hip', 'knee'),
    measured: triple('shoulder', 'hip', 'knee'),
    rest: 135,
    peak: 165,
    shallow: 'Subí más la cadera, hasta alinearla con hombros y rodillas.',
    checks: [profile(0.1, 'shoulder', 'hip')],
  }),
  legRaise: reps({
    id: 'legRaise',
    name: 'Elevación de piernas',
    view: 'side',
    target: 10,
    setup: 'Acostate boca arriba de costado a la cámara, con las piernas estiradas.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    measured: triple('shoulder', 'hip', 'ankle'),
    rest: 160,
    peak: 110,
    shallow: 'Subí las piernas hasta casi 90°.',
    checks: [profile(0.1, 'shoulder', 'hip'), { message: 'Piernas más estiradas.', joints: chain('knee'), ok: (lm, s) => knee(lm, pick(lm, s)) > 140 }],
  }),
  kick: reps({
    id: 'kick',
    name: 'Patada de glúteo',
    view: 'side',
    target: 12,
    setup: 'En cuadrupedia (manos y rodillas), de costado a la cámara.',
    required: chain('shoulder', 'hip', 'knee'),
    // The kicking leg is the one with the open hip, whichever side it is.
    measured: (lm) => {
      const j = hip(lm, JOINTS.left) >= hip(lm, JOINTS.right) ? JOINTS.left : JOINTS.right;
      return [j.shoulder, j.hip, j.knee];
    },
    rest: 110,
    peak: 150,
    shallow: 'Elevá más la pierna, hasta la altura de la cadera.',
    checks: [profile(0.1, 'shoulder', 'hip')],
  }),
};
