import { angle, bestSide, inclination, isAboveLine, JOINTS, type Joints, type Landmarks } from './geometry';

export type RuleId = 'squat' | 'lunge' | 'pushup' | 'plank' | 'sidePlank' | 'bridge' | 'legRaise' | 'kick';

export type Check = {
  message: string;
  /** Landmarks painted red while the check fails. */
  joints: (lm: Landmarks) => number[];
  ok: (lm: Landmarks) => boolean;
};

type BaseRule = {
  id: RuleId;
  name: string;
  view: 'side' | 'front';
  /** How to place the camera, shown before turning it on. */
  setup: string;
  /** Landmarks that must be visible before anything is judged. */
  required: (lm: Landmarks) => number[];
  checks: Check[];
};

/** A rep goes from `rest` to `peak` on `metric` (degrees) and back. */
export type RepRule = BaseRule & { mode: 'reps'; target: number; metric: (lm: Landmarks) => number; rest: number; peak: number; shallow: string };
/** A hold accumulates `target` seconds with every check passing. */
export type HoldRule = BaseRule & { mode: 'hold'; target: number };
export type PoseRule = RepRule | HoldRule;

const side = (lm: Landmarks): Joints => JOINTS[bestSide(lm)];
const knee = (lm: Landmarks, j: Joints) => angle(lm[j.hip], lm[j.knee], lm[j.ankle]);
const hip = (lm: Landmarks, j: Joints) => angle(lm[j.shoulder], lm[j.hip], lm[j.knee]);
const torso = (lm: Landmarks) => {
  const j = side(lm);
  return inclination(lm[j.hip], lm[j.shoulder]);
};
/** Shoulder–hip–ankle: 180 when the body is a straight board. */
const bodyLine = (lm: Landmarks) => {
  const j = side(lm);
  return angle(lm[j.shoulder], lm[j.hip], lm[j.ankle]);
};
const hipAbove = (lm: Landmarks) => {
  const j = side(lm);
  return isAboveLine(lm[j.hip], lm[j.shoulder], lm[j.ankle]);
};
const lying = (lm: Landmarks) => {
  const j = side(lm);
  return inclination(lm[j.ankle], lm[j.shoulder]) > 55;
};
const chain = (...names: (keyof Joints)[]) => (lm: Landmarks) => {
  const j = side(lm);
  return names.map((name) => j[name]);
};

const board = (sag: string, pike: string): Check[] => [
  { message: 'Ponete en posición: cuerpo horizontal.', joints: () => [], ok: lying },
  { message: sag, joints: chain('hip'), ok: (lm) => bodyLine(lm) >= 160 || hipAbove(lm) },
  { message: pike, joints: chain('hip'), ok: (lm) => bodyLine(lm) >= 160 || !hipAbove(lm) },
];

export const RULES: Record<RuleId, PoseRule> = {
  squat: {
    id: 'squat',
    name: 'Sentadilla',
    mode: 'reps',
    view: 'side',
    target: 10,
    setup: 'Ponete de costado a la cámara, a 2–3 metros, que se te vea de la cabeza a los pies.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    metric: (lm) => knee(lm, side(lm)),
    rest: 160,
    peak: 100,
    shallow: 'Bajá más: muslos paralelos al piso.',
    checks: [{ message: 'Mantené el pecho arriba.', joints: chain('shoulder', 'hip'), ok: (lm) => torso(lm) < 50 }],
  },
  lunge: {
    id: 'lunge',
    name: 'Estocada',
    mode: 'reps',
    view: 'side',
    target: 10,
    setup: 'De costado a la cámara, con lugar para dar un paso largo hacia adelante.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    metric: (lm) => Math.min(knee(lm, JOINTS.left), knee(lm, JOINTS.right)),
    rest: 160,
    peak: 105,
    shallow: 'Bajá más: la rodilla de atrás cerca del piso.',
    checks: [{ message: 'Torso erguido.', joints: chain('shoulder', 'hip'), ok: (lm) => torso(lm) < 30 }],
  },
  pushup: {
    id: 'pushup',
    name: 'Flexión de brazos',
    mode: 'reps',
    view: 'side',
    target: 10,
    setup: 'Cámara al costado y a la altura del piso, que se vea el cuerpo entero.',
    required: chain('shoulder', 'elbow', 'wrist', 'hip', 'ankle'),
    metric: (lm) => {
      const j = side(lm);
      return angle(lm[j.shoulder], lm[j.elbow], lm[j.wrist]);
    },
    rest: 155,
    peak: 95,
    shallow: 'Bajá el pecho más cerca del piso.',
    checks: [{ message: 'Cuerpo recto: alineá la cadera.', joints: chain('hip'), ok: (lm) => bodyLine(lm) > 150 }],
  },
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
  bridge: {
    id: 'bridge',
    name: 'Puente de glúteo',
    mode: 'reps',
    view: 'side',
    target: 12,
    setup: 'Acostate boca arriba de costado a la cámara, rodillas flexionadas y pies apoyados.',
    required: chain('shoulder', 'hip', 'knee'),
    metric: (lm) => hip(lm, side(lm)),
    rest: 135,
    peak: 165,
    shallow: 'Subí más la cadera, hasta alinearla con hombros y rodillas.',
    checks: [],
  },
  legRaise: {
    id: 'legRaise',
    name: 'Elevación de piernas',
    mode: 'reps',
    view: 'side',
    target: 10,
    setup: 'Acostate boca arriba de costado a la cámara, con las piernas estiradas.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    metric: (lm) => {
      const j = side(lm);
      return angle(lm[j.shoulder], lm[j.hip], lm[j.ankle]);
    },
    rest: 160,
    peak: 110,
    shallow: 'Subí las piernas hasta casi 90°.',
    checks: [{ message: 'Piernas más estiradas.', joints: chain('knee'), ok: (lm) => knee(lm, side(lm)) > 140 }],
  },
  kick: {
    id: 'kick',
    name: 'Patada de glúteo',
    mode: 'reps',
    view: 'side',
    target: 12,
    setup: 'En cuadrupedia (manos y rodillas), de costado a la cámara.',
    required: chain('shoulder', 'hip', 'knee'),
    metric: (lm) => Math.max(hip(lm, JOINTS.left), hip(lm, JOINTS.right)),
    rest: 110,
    peak: 150,
    shallow: 'Elevá más la pierna, hasta la altura de la cadera.',
    checks: [],
  },
};
