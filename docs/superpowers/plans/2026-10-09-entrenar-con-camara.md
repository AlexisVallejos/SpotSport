# Entrenar con cámara — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `#entrenar` en SpotSport: catálogo de ejercicios de Ritmo-Vida (wger.de) + coach de postura en vivo con la cámara (MediaPipe Pose en el navegador).

**Architecture:** Lógica pura y testeable (`lib/pose/geometry`, `rules`, `engine`; `lib/wger`; `lib/exercises`) separada de la UI (molecule `ExerciseCard`, organisms `ExerciseCatalog` y `PoseCoach`, page `Entrenar`). Navegación por hash sin router; la página se carga con `React.lazy` para no engordar la landing. El runtime WASM de MediaPipe se copia a `public/` en `predev`/`prebuild`.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, CSS Modules, `@mediapipe/tasks-vision@1.0.1`, `vitest@4.1.11`.

**Spec:** `docs/superpowers/specs/2026-10-09-entrenar-con-camara-design.md`

## Global Constraints

- Sin backend ni login: wger se consulta directo desde el browser (`https://wger.de/api/v2`, CORS `*`).
- Idioma de la UI: español rioplatense ("Ubicá", "Bajá").
- Estilo SpotSport: fondo `#080808`, acento `#ff7900`, títulos `'Barlow Condensed'`, texto `Inter`.
- Colores de feedback: correcto `#3ddc84`, error `#ff3b30`.
- Versiones exactas: `@mediapipe/tasks-vision` `1.0.1`, `vitest` `4.1.11` (instalado con `--legacy-peer-deps`: npm 10.9 falla con `edgesOut` sin esa flag).
- El video nunca se envía a ningún servidor.
- Los bloques de código marcados `<!-- file: ruta -->` son el contenido completo del archivo.

---

### Task 1: Tooling (tests, WASM local, nginx)

**Files:**
- Create: `scripts/copy-mediapipe.mjs`
- Modify: `package.json` (scripts), `.gitignore`, `nginx.conf`

**Interfaces:**
- Produces: `npm test` (vitest run), `public/mediapipe/wasm/*` disponible en dev y build.

- [ ] **Step 1: Dependencias** (ya instaladas en esta rama)

```bash
npm install --save-exact @mediapipe/tasks-vision@1.0.1
npm install -D --save-exact --legacy-peer-deps vitest@4.1.11
```

- [ ] **Step 2: Script de copia del WASM**

<!-- file: scripts/copy-mediapipe.mjs -->
```js
// Copia el runtime WASM de MediaPipe a public/ para que el análisis de postura funcione sin CDN.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

if (!existsSync(from)) {
  console.error('Falta @mediapipe/tasks-vision: corré npm install.');
  process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log('MediaPipe WASM copiado a public/mediapipe/wasm');
```

- [ ] **Step 3: Scripts en `package.json`**

```json
"scripts": {
  "predev": "node scripts/copy-mediapipe.mjs",
  "dev": "vite",
  "prebuild": "node scripts/copy-mediapipe.mjs",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "verify:design": "node scripts/verify-design.mjs"
}
```

- [ ] **Step 4: `.gitignore`** — agregar `public/mediapipe/` (se genera).

- [ ] **Step 5: `nginx.conf`** — cachear `.wasm` y `.task` y comprimir wasm:

```nginx
gzip_types text/css application/javascript application/json image/svg+xml font/ttf application/wasm;
...
location ~* \.(?:mp4|jpg|jpeg|png|svg|ico|ttf|wasm|task)$ {
```

- [ ] **Step 6: Verificar** — `node scripts/copy-mediapipe.mjs` imprime el mensaje y crea `public/mediapipe/wasm/vision_wasm_internal.wasm`.

- [ ] **Step 7: Commit** — `chore: tooling para entrenar con cámara`

---

### Task 2: Geometría de pose

**Files:**
- Create: `src/lib/pose/geometry.ts`
- Test: `src/lib/pose/geometry.test.ts`

**Interfaces:**
- Produces: `Point`, `Landmarks`, `LM`, `Side`, `Joints`, `JOINTS`, `angle(a,b,c): number`, `inclination(from,to): number`, `isVisible(lm,i,min?): boolean`, `bestSide(lm): Side`, `isAboveLine(p,a,c): boolean`.

- [ ] **Step 1: Test que falla**

<!-- file: src/lib/pose/geometry.test.ts -->
```ts
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
```

- [ ] **Step 2: Correr y ver que falla** — `npx vitest run src/lib/pose/geometry.test.ts` → FAIL "Failed to resolve import ./geometry".

- [ ] **Step 3: Implementación**

<!-- file: src/lib/pose/geometry.ts -->
```ts
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
```

- [ ] **Step 4: Correr** — `npx vitest run src/lib/pose/geometry.test.ts` → PASS (8 tests).

- [ ] **Step 5: Commit** — `feat(pose): geometría de landmarks`

---

### Task 3: Reglas por ejercicio y motor de seguimiento

**Files:**
- Create: `src/lib/pose/rules.ts`, `src/lib/pose/engine.ts`
- Test: `src/lib/pose/engine.test.ts`

**Interfaces:**
- Consumes: todo lo de Task 2.
- Produces:
  - `RuleId = 'squat'|'lunge'|'pushup'|'plank'|'sidePlank'|'bridge'|'legRaise'|'kick'`
  - `Check = { message; joints(lm): number[]; ok(lm): boolean }`
  - `RepRule` (`mode:'reps'`, `target`, `metric(lm)`, `rest`, `peak`, `shallow`), `HoldRule` (`mode:'hold'`, `target` en segundos), `PoseRule = RepRule | HoldRule` (ambas con `id, name, view, setup, required(lm), checks`)
  - `RULES: Record<RuleId, PoseRule>`
  - `TrackerState = { status:'framing'|'active'; reps; badReps; holdMs; progress; message; tone:'ok'|'warn'|'info'; failing:number[]; errors:Record<string,number> }`
  - `createTracker(rule): { update(lm: Landmarks|null, now: number): TrackerState; reset(): void }`, `FRAMING: string`, `isSetDone(rule, state): boolean`

Reglas de repetición: `progress = (rest − métrica suavizada) / (rest − peak)` acotado a 0–1. Empieza la rep con `progress > 0.25`, termina con `< 0.1`. Rep válida si llegó a 1 sin checks fallando ≥ 3 frames; si no llegó a 1 pero pasó 0.35 → "corregida" con el mensaje `shallow`. Suavizado: media de los últimos 5 frames. Hold: suma tiempo (máx. 200 ms por frame) sólo si todos los checks pasan.

- [ ] **Step 1: Test que falla**

<!-- file: src/lib/pose/engine.test.ts -->
```ts
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
```

- [ ] **Step 2: Correr** — `npx vitest run src/lib/pose/engine.test.ts` → FAIL (no existen `engine`/`rules`).

- [ ] **Step 3: Reglas**

<!-- file: src/lib/pose/rules.ts -->
```ts
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
```

- [ ] **Step 4: Motor**

<!-- file: src/lib/pose/engine.ts -->
```ts
import { isVisible, type Landmarks } from './geometry';
import type { PoseRule } from './rules';

export type Tone = 'ok' | 'warn' | 'info';

export type TrackerState = {
  status: 'framing' | 'active';
  reps: number;
  /** Reps that reached the bottom with bad form, or stopped halfway. */
  badReps: number;
  holdMs: number;
  /** 0–1: how far into the current rep (reps mode). */
  progress: number;
  message: string;
  tone: Tone;
  /** Landmarks to paint red right now. */
  failing: number[];
  /** How many times each correction was given. */
  errors: Record<string, number>;
};

export type Tracker = { update: (lm: Landmarks | null, now: number) => TrackerState; reset: () => void };

export const FRAMING = 'Alejate un poco: necesito verte de la cabeza a los pies.';

const SMOOTHING = 5;
const BAD_FRAMES = 3;
const REP_START = 0.25;
const REP_END = 0.1;
const PARTIAL = 0.35;
const MAX_STEP_MS = 200;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const bump = (errors: Record<string, number>, key: string) => ({ ...errors, [key]: (errors[key] ?? 0) + 1 });

function initial(rule: PoseRule): TrackerState {
  return { status: 'framing', reps: 0, badReps: 0, holdMs: 0, progress: 0, message: rule.mode === 'hold' ? 'Ponete en posición.' : 'Empezá cuando quieras.', tone: 'info', failing: [], errors: {} };
}

export function isSetDone(rule: PoseRule, state: TrackerState): boolean {
  return rule.mode === 'reps' ? state.reps >= rule.target : state.holdMs >= rule.target * 1000;
}

/** Turns a stream of landmarks into reps, hold time and corrections. Pure: no camera, no DOM. */
export function createTracker(rule: PoseRule): Tracker {
  let state = initial(rule);
  let recent: number[] = [];
  let moving = false;
  let deepest = 0;
  let faults: Record<string, number> = {};
  let last: number | null = null;
  let lastFault = '';

  function reset() {
    state = initial(rule);
    recent = [];
    moving = false;
    deepest = 0;
    faults = {};
    last = null;
    lastFault = '';
  }

  function update(lm: Landmarks | null, now: number): TrackerState {
    const step = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;

    if (!lm || !rule.required(lm).every((index) => isVisible(lm, index))) {
      recent = [];
      state = { ...state, status: 'framing', message: FRAMING, tone: 'warn', failing: [] };
      return state;
    }

    const failed = rule.checks.filter((check) => !check.ok(lm));
    const failing = [...new Set(failed.flatMap((check) => check.joints(lm)))];

    if (rule.mode === 'hold') {
      if (failed.length > 0) {
        const message = failed[0].message;
        const errors = message !== lastFault ? bump(state.errors, message) : state.errors;
        lastFault = message;
        state = { ...state, status: 'active', message, tone: 'warn', failing, errors };
      } else {
        lastFault = '';
        state = { ...state, status: 'active', holdMs: state.holdMs + step, message: '¡Bien! Mantené así.', tone: 'ok', failing: [] };
      }
      return state;
    }

    recent.push(rule.metric(lm));
    if (recent.length > SMOOTHING) recent.shift();
    const value = recent.reduce((sum, item) => sum + item, 0) / recent.length;
    const progress = clamp((rule.rest - value) / (rule.rest - rule.peak));
    let { reps, badReps, errors, message, tone } = state;

    if (moving) for (const check of failed) faults[check.message] = (faults[check.message] ?? 0) + 1;

    if (!moving && progress > REP_START) {
      moving = true;
      deepest = progress;
      faults = {};
    } else if (moving) {
      deepest = Math.max(deepest, progress);
      if (progress < REP_END) {
        moving = false;
        const fault = Object.keys(faults).find((key) => faults[key] >= BAD_FRAMES);
        if (deepest >= 1 && !fault) {
          reps += 1;
          message = `¡Bien! Van ${reps}.`;
          tone = 'ok';
        } else if (deepest >= 1 && fault) {
          badReps += 1;
          errors = bump(errors, fault);
          message = fault;
          tone = 'warn';
        } else if (deepest >= PARTIAL) {
          badReps += 1;
          errors = bump(errors, rule.shallow);
          message = rule.shallow;
          tone = 'warn';
        }
      }
    }

    if (moving && failed.length > 0) {
      message = failed[0].message;
      tone = 'warn';
    }

    state = { ...state, status: 'active', reps, badReps, errors, message, tone, progress, failing };
    return state;
  }

  return { update, reset };
}
```

- [ ] **Step 5: Correr** — `npx vitest run src/lib/pose` → PASS (todos).

- [ ] **Step 6: Commit** — `feat(pose): reglas de 8 ejercicios y motor de reps/hold`

---

### Task 4: Catálogo (wger + respaldo local + emparejado con reglas)

**Files:**
- Create: `src/lib/wger.ts`, `src/lib/exercises/local.ts`, `src/lib/exercises/match.ts`
- Test: `src/lib/wger.test.ts`, `src/lib/exercises/match.test.ts`

**Interfaces:**
- Consumes: `RULES`, `PoseRule` (Task 3).
- Produces:
  - `Exercise = { id:number; name:string; category:number; muscles:string[]; equipment:string[]; image:string|null; lines:string[]; tip?:string; easier?:string; source:'ritmo'|'wger' }`
  - `CATEGORY: Record<number,string>`, `slim(entry): Exercise|null`, `loadCatalog(): Promise<Exercise[]>`, `searchExercises(list, query, category: number|null): Exercise[]`
  - `LOCAL_EXERCISES: Exercise[]`
  - `ruleFor(name: string): PoseRule | null`

- [ ] **Step 1: Tests que fallan**

<!-- file: src/lib/wger.test.ts -->
```ts
import { describe, expect, it } from 'vitest';
import { searchExercises, slim, type Exercise } from './wger';

describe('slim', () => {
  it('keeps the Spanish translation as plain text', () => {
    const exercise = slim({
      id: 7,
      category: { id: 9 },
      muscles: [{ name_en: 'Quads' }],
      muscles_secondary: [{ name_en: 'Glutes' }],
      equipment: [{ id: 7 }],
      images: [{ is_main: true, image: 'https://wger.de/a.png' }],
      translations: [
        { language: 2, name: 'Squat', description: '<p>English</p>' },
        { language: 4, name: ' Sentadilla ', description: '<p>Bajá&nbsp;lento.</p><p>Subí.</p>' },
      ],
    });
    expect(exercise).toEqual({
      id: 7,
      name: 'Sentadilla',
      category: 9,
      muscles: ['Cuádriceps', 'Glúteos'],
      equipment: ['Sin equipo'],
      image: 'https://wger.de/a.png',
      lines: ['Bajá lento.', 'Subí.'],
      source: 'wger',
    });
  });

  it('drops exercises without Spanish', () => {
    expect(slim({ id: 1, translations: [{ language: 2, name: 'Squat' }] })).toBeNull();
  });
});

describe('searchExercises', () => {
  const make = (id: number, name: string, category: number, image: string | null = null): Exercise => ({ id, name, category, muscles: [], equipment: [], image, lines: [], source: 'wger' });
  const list = [make(1, 'Press de banca', 11), make(2, 'Sentadilla búlgara', 9), make(3, 'Sentadilla', 9, 'x.png'), make(4, 'Plancha', 10)];

  it('matches words ignoring accents and case', () => {
    expect(searchExercises(list, 'SENTADÍLLA', null).map((item) => item.id)).toEqual([3, 2]);
  });
  it('matches the category name', () => {
    expect(searchExercises(list, 'piernas', null).map((item) => item.id)).toEqual([3, 2]);
  });
  it('filters by category', () => {
    expect(searchExercises(list, '', 10).map((item) => item.id)).toEqual([4]);
  });
  it('returns everything for an empty query, images first', () => {
    expect(searchExercises(list, '', null).map((item) => item.id)).toEqual([3, 1, 2, 4]);
  });
});
```

<!-- file: src/lib/exercises/match.test.ts -->
```ts
import { describe, expect, it } from 'vitest';
import { LOCAL_EXERCISES } from './local';
import { ruleFor } from './match';

describe('ruleFor', () => {
  it.each([
    ['Sentadilla profunda', 'squat'],
    ['Estocadas alternadas', 'lunge'],
    ['Zancadas con mancuernas', 'lunge'],
    ['Flexiones diamante', 'pushup'],
    ['Push-ups', 'pushup'],
    ['Plancha abdominal', 'plank'],
    ['Plancha lateral', 'sidePlank'],
    ['Hip thrust con pelota', 'bridge'],
    ['Puente de glúteo', 'bridge'],
    ['Levantamiento de piernas', 'legRaise'],
    ['Elevación de piernas colgado', 'legRaise'],
    ['Patada de glúteo', 'kick'],
  ])('%s → %s', (name, id) => {
    expect(ruleFor(name)?.id).toBe(id);
  });

  it.each(['Curl de bíceps', 'Flexión de bíceps', 'Flexión de piernas tumbado', 'Press de banca'])('%s has no rule', (name) => {
    expect(ruleFor(name)).toBeNull();
  });

  it('covers every local exercise', () => {
    for (const exercise of LOCAL_EXERCISES) expect(ruleFor(exercise.name), exercise.name).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr** — `npx vitest run src/lib/wger.test.ts src/lib/exercises` → FAIL (módulos inexistentes).

- [ ] **Step 3: wger** (portado de `ritmo-vida/supabase/functions/ritmo-life/wger.ts`, sin filtro de equipo y con caché en `sessionStorage`)

<!-- file: src/lib/wger.ts -->
```ts
// Ejercicios de wger (https://wger.de): la misma base abierta que usa Ritmo-Vida, en español.
const API = 'https://wger.de/api/v2';
const SPANISH = 4;
const CACHE_KEY = 'spot:wger:v1';

export type Exercise = {
  id: number;
  name: string;
  category: number;
  muscles: string[];
  equipment: string[];
  image: string | null;
  lines: string[];
  tip?: string;
  easier?: string;
  source: 'ritmo' | 'wger';
};

export const CATEGORY: Record<number, string> = { 8: 'Brazos', 9: 'Piernas', 10: 'Abdomen', 11: 'Pecho', 12: 'Espalda', 13: 'Hombros', 14: 'Pantorrillas', 15: 'Cardio' };

const EQUIPMENT: Record<number, string> = {
  1: 'Barra',
  2: 'Barra Z',
  3: 'Mancuernas',
  4: 'Colchoneta',
  5: 'Pelota suiza',
  6: 'Barra de dominadas',
  7: 'Sin equipo',
  8: 'Banco',
  9: 'Banco inclinado',
  10: 'Pesa rusa',
  11: 'Banda elástica',
  12: 'Polea',
};

const MUSCLE: Record<string, string> = {
  Shoulders: 'Hombros',
  Biceps: 'Bíceps',
  Chest: 'Pecho',
  Triceps: 'Tríceps',
  Abs: 'Abdomen',
  Quads: 'Cuádriceps',
  Glutes: 'Glúteos',
  Calves: 'Pantorrillas',
  Hamstrings: 'Isquiotibiales',
  Lats: 'Dorsales',
  Traps: 'Trapecios',
  Obliques: 'Oblicuos',
  Brachialis: 'Braquial',
  'Lower back': 'Zona lumbar',
};

type Raw = Record<string, any>;

function plain(html: string): string[] {
  return html
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1);
}

/** One wger entry, slimmed down to what the page shows. Null when it has no Spanish translation. */
export function slim(entry: Raw): Exercise | null {
  const translation = (entry.translations ?? []).find((item: Raw) => item.language === SPANISH && String(item.name ?? '').trim());
  if (!translation) return null;
  const main = (entry.images ?? []).find((image: Raw) => image.is_main) ?? entry.images?.[0];
  const muscles = [...(entry.muscles ?? []), ...(entry.muscles_secondary ?? [])].map((muscle: Raw) => MUSCLE[muscle.name_en] ?? muscle.name_en).filter(Boolean);
  return {
    id: entry.id,
    name: String(translation.name).trim(),
    category: entry.category?.id ?? 0,
    muscles: [...new Set<string>(muscles)].slice(0, 4),
    equipment: (entry.equipment ?? []).map((item: Raw) => EQUIPMENT[item.id]).filter(Boolean),
    image: main?.thumbnails?.medium ?? main?.image ?? null,
    lines: plain(String(translation.description ?? '')).slice(0, 14),
    source: 'wger',
  };
}

async function page(offset: number): Promise<Raw> {
  const response = await fetch(`${API}/exerciseinfo/?language=${SPANISH}&limit=100&offset=${offset}&format=json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`wger respondió ${response.status}.`);
  return await response.json();
}

function cached(): Exercise[] | null {
  try {
    const text = sessionStorage.getItem(CACHE_KEY);
    return text ? (JSON.parse(text) as Exercise[]) : null;
  } catch {
    return null;
  }
}

/** Every exercise wger has in Spanish. Fetched once per browser session. */
export async function loadCatalog(): Promise<Exercise[]> {
  const hit = cached();
  if (hit) return hit;
  const first = await page(0);
  const total = Number(first.count ?? 0);
  const offsets: number[] = [];
  for (let offset = 100; offset < total; offset += 100) offsets.push(offset);
  const rest = await Promise.all(offsets.map((offset) => page(offset).catch(() => ({ results: [] }))));
  const seen = new Set<number>();
  const exercises: Exercise[] = [];
  for (const entry of [first, ...rest].flatMap((chunk) => chunk.results ?? [])) {
    const item = slim(entry);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      exercises.push(item);
    }
  }
  if (exercises.length < 20) throw new Error('wger devolvió muy pocos ejercicios.');
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(exercises));
  } catch {
    // Sin storage (modo privado): se vuelve a pedir la próxima vez.
  }
  return exercises;
}

export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Exercises matching every typed word (name, muscles or category), optionally inside one category. */
export function searchExercises(list: Exercise[], query: string, category: number | null): Exercise[] {
  const words = fold(query).split(/\s+/).filter((word) => word.length >= 3);
  return list
    .filter((exercise) => category === null || exercise.category === category)
    .map((exercise) => {
      const haystack = fold(`${exercise.name} ${exercise.muscles.join(' ')} ${CATEGORY[exercise.category] ?? ''}`);
      return { exercise, score: words.filter((word) => haystack.includes(word)).length };
    })
    .filter((item) => words.length === 0 || item.score === words.length)
    .sort((a, b) => b.score - a.score || Number(!!b.exercise.image) - Number(!!a.exercise.image))
    .map((item) => item.exercise);
}
```

- [ ] **Step 4: Respaldo local** (de `ritmo-vida/src/data/training.ts`)

<!-- file: src/lib/exercises/local.ts -->
```ts
import type { Exercise } from '../wger';

const ritmo = (id: number, name: string, category: number, muscles: string[], lines: string[], tip: string, easier: string): Exercise => ({ id, name, category, muscles, equipment: ['Sin equipo'], image: null, lines, tip, easier, source: 'ritmo' });

/** Rutinas de Ritmo-Vida con análisis de postura. Siempre disponibles, aunque wger no responda. */
export const LOCAL_EXERCISES: Exercise[] = [
  ritmo(-1, 'Sentadilla profunda', 9, ['Cuádriceps', 'Glúteos'], ['Pies al ancho de caderas, puntas apenas abiertas.', 'Llevá las caderas atrás y abajo.', 'Bajá manteniendo el pecho arriba.', 'Subí empujando con talones.'], 'Las rodillas acompañan la dirección de los pies.', 'Bajá hasta un rango cómodo.'),
  ritmo(-2, 'Estocadas', 9, ['Cuádriceps', 'Glúteos'], ['Da un paso largo hacia adelante.', 'Bajá la rodilla trasera cerca del piso.', 'Volvé y alterná piernas.'], 'Mantené el torso vertical.', 'Sujetate de una pared.'),
  ritmo(-3, 'Flexiones de brazos', 11, ['Pecho', 'Tríceps'], ['Manos al ancho de hombros.', 'Formá una línea recta de talones a cabeza.', 'Bajá el pecho hacia el piso con los codos cerca del cuerpo.', 'Empujá hasta extender los brazos.'], 'Priorizá técnica antes que velocidad.', 'Hacelas desde rodillas.'),
  ritmo(-4, 'Plancha abdominal', 10, ['Abdomen'], ['Apoyá antebrazos y puntas de los pies.', 'Mantené cabeza, caderas y talones en una línea.', 'Sostené 30 segundos sin dejar caer la cadera.'], 'Contraé el abdomen todo el tiempo.', 'Apoyá las rodillas.'),
  ritmo(-5, 'Plancha lateral', 10, ['Oblicuos', 'Abdomen'], ['Apoyá antebrazo y codo debajo del hombro.', 'Elevá caderas hasta formar una línea recta.', 'Sostené y repetí del otro lado.'], 'No dejes caer la cadera.', 'Apoyá las rodillas.'),
  ritmo(-6, 'Puente de glúteo', 9, ['Glúteos', 'Isquiotibiales'], ['Acostate boca arriba con las rodillas flexionadas.', 'Pies firmes en el piso.', 'Empujá con talones y elevá caderas.', 'Contraé glúteos arriba y bajá controlado.'], 'No hiperextiendas la espalda.', 'Reducí el rango de movimiento.'),
  ritmo(-7, 'Levantamiento de piernas', 10, ['Abdomen'], ['Acostate con las palmas apoyadas al costado.', 'Subí ambas piernas hasta 90 grados.', 'Bajá lento sin apoyar los pies.'], 'Mantené la espalda baja cerca del piso.', 'Flexioná ligeramente las rodillas.'),
  ritmo(-8, 'Patada de glúteo', 9, ['Glúteos'], ['En cuadrupedia, alineá manos y hombros.', 'Elevá una pierna doblada a 90 grados.', 'Contraé arriba y bajá sin tocar el piso.', 'Cambiá de pierna al terminar.'], 'El movimiento es pequeño y controlado.', 'Reducí el rango.'),
];
```

- [ ] **Step 5: Emparejado nombre → regla**

<!-- file: src/lib/exercises/match.ts -->
```ts
import { RULES, type PoseRule, type RuleId } from '../pose/rules';
import { fold } from '../wger';

/** Order matters: the first pattern that matches wins ("plancha lateral" before "plancha"). */
const PATTERNS: [RegExp, RuleId][] = [
  [/plancha lateral|side plank/, 'sidePlank'],
  [/plancha|plank/, 'plank'],
  [/sentadilla|squat/, 'squat'],
  [/estocada|zancada|lunge/, 'lunge'],
  [/puente|hip thrust|glute bridge/, 'bridge'],
  [/(elevacion|levantamiento)(es)? de piernas|leg raise/, 'legRaise'],
  [/patada de gluteo|patada trasera|donkey kick/, 'kick'],
  [/flexion|push.?up|lagartija/, 'pushup'],
];

/** Flexión also names curls and machine work: those are not push-ups. */
const NOT_PUSHUP = /biceps|rodilla|pierna|plantar|cadera|muneca|tronco|isquio|femoral|nordic|curl/;

export function ruleFor(name: string): PoseRule | null {
  const text = fold(name);
  for (const [pattern, id] of PATTERNS) {
    if (!pattern.test(text)) continue;
    if (id === 'pushup' && NOT_PUSHUP.test(text)) return null;
    return RULES[id];
  }
  return null;
}
```

- [ ] **Step 6: Correr** — `npm test` → PASS (todas las suites).

- [ ] **Step 7: Commit** — `feat(entrenar): catálogo wger, respaldo Ritmo-Vida y emparejado con reglas`

---

### Task 5: Ruta `#entrenar`, carga del modelo e íconos

**Files:**
- Create: `src/lib/hashRoute.ts`, `src/lib/pose/landmarker.ts`
- Modify: `src/main.tsx`, `src/components/atoms/Icon/Icon.tsx`, `src/components/organisms/TrainingCampaign/TrainingCampaign.tsx`, `src/components/organisms/TrainingCampaign/TrainingCampaign.module.css`

**Interfaces:**
- Produces: `useHashRoute(): string`; `loadLandmarker(): Promise<PoseLandmarker>`; `POSE_CONNECTIONS: {start:number; end:number}[]`; `IconName` suma `'camera' | 'arrowLeft'`; default export lazy de `src/pages/Entrenar.tsx` (Task 7).

- [ ] **Step 1: Hash route**

<!-- file: src/lib/hashRoute.ts -->
```ts
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

const read = () => window.location.hash.replace(/^#\/?/, '');

/** The current `#route` without the hash. Anchors of the landing (#deportes…) also show up here. */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, read, () => '');
}
```

- [ ] **Step 2: Carga del modelo** (WASM local; modelo local si existe en `public/models/`, si no el oficial de Google)

<!-- file: src/lib/pose/landmarker.ts -->
```ts
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const LOCAL_MODEL = '/models/pose_landmarker_lite.task';
const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

let loading: Promise<PoseLandmarker> | null = null;

/** Prefers a copy in public/models (works offline at the expo); the dev server answers missing files with HTML. */
async function modelPath(): Promise<string> {
  try {
    const response = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return LOCAL_MODEL;
  } catch {
    // Sin copia local: se usa la de Google.
  }
  return REMOTE_MODEL;
}

async function create(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const modelAssetPath = await modelPath();
  const options = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO' as const, numPoses: 1 });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    return await PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/** One shared landmarker for the whole session; a failed load can be retried. */
export function loadLandmarker(): Promise<PoseLandmarker> {
  loading ??= create().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
```

- [ ] **Step 3: Íconos** — en `Icon.tsx` importar `ArrowLeft, Camera` de `lucide-react`, sumar `'arrowLeft' | 'camera'` a `IconName` y `arrowLeft: ArrowLeft, camera: Camera` a `lucideIcons`.

- [ ] **Step 4: `main.tsx`** — renderizar según la ruta:

<!-- file: src/main.tsx -->
```tsx
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import SPOTTodoElDeporte from './pages/SPOTTodoElDeporte';
import { useHashRoute } from './lib/hashRoute';
import './global.css';

// La página de entrenamiento trae MediaPipe: se descarga sólo cuando se abre.
const Entrenar = lazy(() => import('./pages/Entrenar'));

// Los enlaces todavía no tienen destino: evitamos que "#" salte al inicio de la página.
document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest('a[href="#"]');
  if (link) event.preventDefault();
});

function App() {
  const route = useHashRoute();
  if (route !== 'entrenar') return <SPOTTodoElDeporte />;
  return (
    <Suspense fallback={<div className="route-loading" role="status">Cargando…</div>}>
      <Entrenar />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Y en `global.css`:

```css
.route-loading {
  	min-height: 100vh;
  	display: grid;
  	place-items: center;
  	color: #a7a9b2;
  	font-family: Inter;
}
```

- [ ] **Step 5: Link desde la landing** — en `TrainingCampaign.tsx` envolver el `ActionButton` existente y sumar uno nuevo:

```tsx
<div className={styles.actions}>
  <ActionButton variant="campaign" label="Armá tu equipo de training" />
  <ActionButton variant="light" label="Entrená con cámara" href="#entrenar" />
</div>
```

```css
.actions {
  	display: flex;
  	flex-wrap: wrap;
  	gap: 12px;
}
```

- [ ] **Step 6:** se verifica con `npm run build` al final de Task 7 (todavía falta `pages/Entrenar`).

- [ ] **Step 7: Commit** — `feat(entrenar): ruta por hash, carga de MediaPipe y link desde la landing`

---

### Task 6: Catálogo en pantalla

**Files:**
- Create: `src/components/molecules/ExerciseCard/ExerciseCard.tsx` + `.module.css`, `src/components/organisms/ExerciseCatalog/ExerciseCatalog.tsx` + `.module.css`
- Modify: `src/components/molecules/index.ts`, `src/components/organisms/index.ts`

**Interfaces:**
- Consumes: `Exercise`, `CATEGORY`, `loadCatalog`, `searchExercises` (Task 4), `LOCAL_EXERCISES`, `ruleFor`, `Icon` (`camera`, `search`, `x`).
- Produces: `<ExerciseCard exercise hasPose selected onSelect />`, `<ExerciseCatalog onStart={(exercise: Exercise) => void} />`.

- [ ] **Step 1: ExerciseCard** — ver bloques `ExerciseCard.tsx` y `ExerciseCard.module.css` abajo.

<!-- file: src/components/molecules/ExerciseCard/ExerciseCard.tsx -->
```tsx
import { FunctionComponent } from 'react';
import { Icon } from '../../atoms';
import { CATEGORY, type Exercise } from '../../../lib/wger';
import styles from './ExerciseCard.module.css';

export type ExerciseCardProps = {
  exercise: Exercise;
  hasPose: boolean;
  selected: boolean;
  onSelect: () => void;
};

const ExerciseCard: FunctionComponent<ExerciseCardProps> = ({ exercise, hasPose, selected, onSelect }) => {
  const meta = [CATEGORY[exercise.category], ...exercise.muscles.slice(0, 2)].filter(Boolean).join(' · ');
  return (
    <button type="button" className={`${styles.card} ${selected ? styles.selected : ''}`} onClick={onSelect} aria-pressed={selected}>
      <span className={styles.media}>
        {exercise.image ? (
          <img src={exercise.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            {exercise.name.charAt(0)}
          </span>
        )}
        {hasPose ? (
          <span className={styles.badge}>
            <Icon name="camera" size={16} /> Postura
          </span>
        ) : null}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{exercise.name}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
    </button>
  );
};

export default ExerciseCard;
```

<!-- file: src/components/molecules/ExerciseCard/ExerciseCard.module.css -->
```css
.card {
  	display: flex;
  	flex-direction: column;
  	width: 100%;
  	background-color: #121212;
  	border: 1px solid #242424;
  	color: #fff;
  	text-align: left;
  	transition: border-color 0.2s ease, transform 0.2s ease;
}
.card:hover {
  	border-color: #ff7900;
}
.selected {
  	border-color: #ff7900;
  	box-shadow: 0 0 0 1px #ff7900;
}
.media {
  	position: relative;
  	display: grid;
  	place-items: center;
  	aspect-ratio: 4 / 3;
  	background-color: #f1f1f1;
  	overflow: hidden;
}
.media img {
  	width: 100%;
  	height: 100%;
  	object-fit: contain;
}
.placeholder {
  	width: 100%;
  	height: 100%;
  	display: grid;
  	place-items: center;
  	background-color: #1b1b1b;
  	color: #ff7900;
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 64px;
}
.badge {
  	position: absolute;
  	top: 8px;
  	left: 8px;
  	display: inline-flex;
  	align-items: center;
  	gap: 6px;
  	padding: 4px 8px;
  	background-color: #ff7900;
  	color: #080808;
  	font-family: Inter;
  	font-size: 11px;
  	font-weight: 600;
  	text-transform: uppercase;
  	letter-spacing: 0.06em;
}
.body {
  	display: flex;
  	flex-direction: column;
  	gap: 4px;
  	padding: 12px;
}
.name {
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 20px;
  	line-height: 1.05;
  	text-transform: uppercase;
}
.meta {
  	font-family: Inter;
  	font-size: 12px;
  	color: #9a9ca5;
}
@media (prefers-reduced-motion: reduce) {
  	.card {
    		transition: none;
  	}
}
```

- [ ] **Step 2: ExerciseCatalog**

<!-- file: src/components/organisms/ExerciseCatalog/ExerciseCatalog.tsx -->
```tsx
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../atoms';
import { ExerciseCard } from '../../molecules';
import { LOCAL_EXERCISES } from '../../../lib/exercises/local';
import { ruleFor } from '../../../lib/exercises/match';
import { CATEGORY, loadCatalog, searchExercises, type Exercise } from '../../../lib/wger';
import styles from './ExerciseCatalog.module.css';

export type ExerciseCatalogProps = {
  onStart: (exercise: Exercise) => void;
};

const CHIPS: { label: string; category: number | null }[] = [
  { label: 'Todos', category: null },
  { label: 'Piernas', category: 9 },
  { label: 'Pecho', category: 11 },
  { label: 'Espalda', category: 12 },
  { label: 'Abdomen', category: 10 },
  { label: 'Hombros', category: 13 },
  { label: 'Brazos', category: 8 },
  { label: 'Cardio', category: 15 },
];

const LIMIT = 60;

const ExerciseCatalog: FunctionComponent<ExerciseCatalogProps> = ({ onStart }) => {
  const [catalog, setCatalog] = useState<Exercise[]>(LOCAL_EXERCISES);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [onlyPose, setOnlyPose] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((list) => {
        if (!alive) return;
        setCatalog([...LOCAL_EXERCISES, ...list]);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('offline');
      });
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => searchExercises(catalog, query, category).filter((exercise) => !onlyPose || ruleFor(exercise.name)), [catalog, query, category, onlyPose]);
  const shown = results.slice(0, LIMIT);
  const selected = catalog.find((exercise) => exercise.id === selectedId) ?? null;
  const selectedRule = selected ? ruleFor(selected.name) : null;

  return (
    <section className={styles.catalog} aria-labelledby="catalogo-titulo">
      <header className={styles.head}>
        <p className={styles.kicker}>RITMO-VIDA × SPOT</p>
        <h1 id="catalogo-titulo" className={styles.title}>
          ENTRENÁ
          <br />
          CON CÁMARA.
        </h1>
        <p className={styles.lead}>Elegí un ejercicio, activá la cámara y te corregimos la postura en vivo. El video se analiza en tu compu: no se sube a ningún lado.</p>
      </header>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Músculo o ejercicio: sentadilla, espalda…" aria-label="Buscar ejercicios" />
        </label>
        <div className={styles.chips} role="group" aria-label="Filtrar por músculo">
          {CHIPS.map((chip) => (
            <button key={chip.label} type="button" className={`${styles.chip} ${chip.category === category ? styles.chipOn : ''}`} aria-pressed={chip.category === category} onClick={() => setCategory(chip.category)}>
              {chip.label}
            </button>
          ))}
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={onlyPose} onChange={(event) => setOnlyPose(event.target.checked)} />
          Solo con análisis de postura
        </label>
      </div>

      {status === 'loading' ? (
        <p className={styles.note} role="status">
          Cargando ejercicios de wger…
        </p>
      ) : null}
      {status === 'offline' ? (
        <p className={styles.note} role="status">
          Sin conexión con wger: mostramos los ejercicios de Ritmo-Vida.
        </p>
      ) : null}

      <div className={`${styles.layout} ${selected ? styles.withDetail : ''}`}>
        {shown.length === 0 ? (
          <p className={styles.empty}>Sin resultados. Probá con otro músculo{onlyPose ? ' o desactivá «Solo con análisis de postura»' : ''}.</p>
        ) : (
          <div className={styles.grid}>
            {shown.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} hasPose={!!ruleFor(exercise.name)} selected={exercise.id === selectedId} onSelect={() => setSelectedId(exercise.id === selectedId ? null : exercise.id)} />
            ))}
          </div>
        )}

        {selected ? (
          <aside className={styles.detail} aria-label={`Detalle: ${selected.name}`}>
            <button type="button" className={styles.close} onClick={() => setSelectedId(null)} aria-label="Cerrar detalle">
              <Icon name="x" size={18} />
            </button>
            {selected.image ? <img className={styles.detailImage} src={selected.image} alt="" /> : null}
            <h2 className={styles.detailTitle}>{selected.name}</h2>
            <p className={styles.meta}>{[CATEGORY[selected.category], ...selected.muscles, ...selected.equipment].filter(Boolean).join(' · ')}</p>
            {selected.lines.length > 0 ? (
              <ol className={styles.steps}>
                {selected.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.meta}>Sin descripción en español.</p>
            )}
            {selected.tip ? (
              <p className={styles.tip}>
                <strong>Tip:</strong> {selected.tip}
              </p>
            ) : null}
            {selected.easier ? (
              <p className={styles.tip}>
                <strong>Más fácil:</strong> {selected.easier}
              </p>
            ) : null}
            <p className={styles.poseNote}>
              {selectedRule
                ? `Análisis de postura: ${selectedRule.mode === 'hold' ? 'cronómetro' : 'contador de repeticiones'} con corrección en vivo.`
                : 'Este ejercicio todavía no tiene análisis de postura: vas a ver tu esqueleto, sin corrección.'}
            </p>
            <button type="button" className={styles.start} onClick={() => onStart(selected)}>
              <Icon name="camera" /> Empezar con cámara
            </button>
          </aside>
        ) : null}
      </div>

      {results.length > LIMIT ? (
        <p className={styles.note}>
          Mostrando {LIMIT} de {results.length}. Buscá para encontrar más.
        </p>
      ) : null}
      <p className={styles.credit}>Ejercicios de wger.de (licencia Creative Commons; imágenes y textos de sus autores) y rutinas de Ritmo-Vida.</p>
    </section>
  );
};

export default ExerciseCatalog;
```

<!-- file: src/components/organisms/ExerciseCatalog/ExerciseCatalog.module.css -->
```css
.catalog {
  	display: flex;
  	flex-direction: column;
  	gap: 28px;
  	color: #fff;
  	font-family: Inter;
}
.head {
  	display: flex;
  	flex-direction: column;
  	gap: 16px;
}
.kicker {
  	margin: 0;
  	font-size: 11px;
  	letter-spacing: 0.2em;
  	color: #ff7900;
  	font-weight: 600;
}
.title {
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: clamp(52px, 7.5vw, 112px);
  	line-height: 0.92;
}
.lead {
  	margin: 0;
  	max-width: 600px;
  	font-size: 15px;
  	line-height: 1.6;
  	color: #a7a9b2;
}
.controls {
  	display: flex;
  	flex-direction: column;
  	gap: 14px;
}
.search {
  	display: flex;
  	align-items: center;
  	gap: 10px;
  	height: 52px;
  	padding: 0 16px;
  	max-width: 640px;
  	background-color: #121212;
  	border: 1px solid #2a2a2a;
  	color: #a7a9b2;
}
.search:focus-within {
  	border-color: #ff7900;
}
.search input {
  	flex: 1;
  	min-width: 0;
  	height: 100%;
  	background: transparent;
  	border: 0;
  	outline: none;
  	color: #fff;
  	font: inherit;
  	font-size: 15px;
}
.chips {
  	display: flex;
  	flex-wrap: wrap;
  	gap: 8px;
}
.chip {
  	height: 36px;
  	padding: 0 14px;
  	border: 1px solid #2a2a2a;
  	color: #d0d1d6;
  	font-size: 13px;
}
.chip:hover {
  	border-color: #ff7900;
}
.chipOn {
  	background-color: #ff7900;
  	border-color: #ff7900;
  	color: #080808;
  	font-weight: 600;
}
.toggle {
  	display: inline-flex;
  	align-items: center;
  	gap: 8px;
  	font-size: 13px;
  	color: #a7a9b2;
  	cursor: pointer;
  	width: fit-content;
}
.toggle input {
  	accent-color: #ff7900;
  	width: 16px;
  	height: 16px;
}
.note,
.empty,
.credit {
  	margin: 0;
  	font-size: 13px;
  	color: #8a8c94;
}
.layout {
  	display: grid;
  	grid-template-columns: minmax(0, 1fr);
  	gap: 24px;
  	align-items: start;
}
.withDetail {
  	grid-template-columns: minmax(0, 1fr) 380px;
}
.grid {
  	display: grid;
  	grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  	gap: 12px;
}
.detail {
  	position: sticky;
  	top: 84px;
  	display: flex;
  	flex-direction: column;
  	gap: 14px;
  	max-height: calc(100vh - 108px);
  	overflow-y: auto;
  	padding: 20px;
  	background-color: #111;
  	border: 1px solid #2a2a2a;
}
.close {
  	align-self: flex-end;
  	display: grid;
  	place-items: center;
  	width: 36px;
  	height: 36px;
  	border: 1px solid #2a2a2a;
}
.detailImage {
  	width: 100%;
  	max-height: 220px;
  	object-fit: contain;
  	background-color: #f1f1f1;
}
.detailTitle {
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 34px;
  	line-height: 1;
  	text-transform: uppercase;
}
.meta {
  	margin: 0;
  	font-size: 13px;
  	color: #9a9ca5;
}
.steps {
  	margin: 0;
  	padding-left: 20px;
  	display: flex;
  	flex-direction: column;
  	gap: 8px;
  	font-size: 14px;
  	line-height: 1.5;
  	color: #d9dae0;
}
.tip {
  	margin: 0;
  	font-size: 14px;
  	line-height: 1.5;
  	color: #d9dae0;
}
.tip strong {
  	color: #ff7900;
}
.poseNote {
  	margin: 0;
  	padding: 10px 12px;
  	border-left: 3px solid #ff7900;
  	background-color: rgba(255, 121, 0, 0.08);
  	font-size: 13px;
  	line-height: 1.5;
  	color: #d9dae0;
}
.start {
  	display: flex;
  	align-items: center;
  	justify-content: center;
  	gap: 10px;
  	height: 52px;
  	width: 100%;
  	background-color: #ff7900;
  	color: #080808;
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 20px;
  	text-transform: uppercase;
  	letter-spacing: 0.04em;
}
.start:hover {
  	filter: brightness(1.08);
}
@media (max-width: 899px) {
  	.withDetail {
    		grid-template-columns: minmax(0, 1fr);
  	}
  	.detail {
    		position: fixed;
    		top: auto;
    		left: 0;
    		right: 0;
    		bottom: 0;
    		z-index: 20;
    		max-height: 78vh;
    		border-top: 2px solid #ff7900;
    		box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.6);
  	}
}
```

- [ ] **Step 3: Exports** — `molecules/index.ts`: `export { default as ExerciseCard } from './ExerciseCard/ExerciseCard';` y `export type { ExerciseCardProps } from './ExerciseCard/ExerciseCard';`. `organisms/index.ts`: `export { default as ExerciseCatalog } from './ExerciseCatalog/ExerciseCatalog';`.

- [ ] **Step 4: Commit** — `feat(entrenar): catálogo con buscador, filtros y detalle`

---

### Task 7: Coach con cámara y página Entrenar

**Files:**
- Create: `src/components/organisms/PoseCoach/PoseCoach.tsx` + `.module.css`, `src/pages/Entrenar.tsx`, `src/pages/Entrenar.module.css`
- Modify: `src/components/organisms/index.ts`

**Interfaces:**
- Consumes: `createTracker`, `isSetDone`, `TrackerState`, `Tracker` (Task 3), `loadLandmarker`, `POSE_CONNECTIONS` (Task 5), `ruleFor` (Task 4), `ExerciseCatalog` (Task 6).
- Produces: `<PoseCoach exercise rule onExit />`, default export `Entrenar`.

- [ ] **Step 1: PoseCoach**

<!-- file: src/components/organisms/PoseCoach/PoseCoach.tsx -->
```tsx
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Icon } from '../../atoms';
import { createTracker, isSetDone, type Tracker, type TrackerState } from '../../../lib/pose/engine';
import type { Landmarks } from '../../../lib/pose/geometry';
import { loadLandmarker, POSE_CONNECTIONS } from '../../../lib/pose/landmarker';
import type { PoseRule } from '../../../lib/pose/rules';
import type { Exercise } from '../../../lib/wger';
import styles from './PoseCoach.module.css';

export type PoseCoachProps = {
  exercise: Exercise;
  rule: PoseRule | null;
  onExit: () => void;
};

type Phase = 'setup' | 'starting' | 'live' | 'done' | 'error';
type Problem = 'denied' | 'nocamera' | 'insecure' | 'model' | 'other';
type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

const SETS = 3;
const EMPTY: Totals = { reps: 0, badReps: 0, holdMs: 0, errors: {} };
const OK = '#3ddc84';
const BAD = '#ff3b30';
const NEUTRAL = '#ff7900';

const PROBLEMS: Record<Problem, { title: string; text: string }> = {
  denied: { title: 'Sin permiso para la cámara', text: 'Tocá el ícono de la cámara o del candado en la barra de direcciones, elegí «Permitir» y volvé a intentar.' },
  nocamera: { title: 'No encontramos una cámara', text: 'Conectá una webcam o cerrá otras apps que la estén usando (Zoom, Meet, OBS…).' },
  insecure: { title: 'La cámara necesita HTTPS', text: 'Abrí la página con https:// o desde localhost: el navegador bloquea la cámara en sitios sin cifrar.' },
  model: { title: 'No se pudo cargar el analizador', text: 'Revisá tu conexión a internet e intentá de nuevo.' },
  other: { title: 'No pudimos abrir la cámara', text: 'Intentá de nuevo. Si sigue fallando, recargá la página.' },
};

function problemOf(error: unknown): Problem {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'nocamera';
  return 'other';
}

function add(totals: Totals, state: TrackerState): Totals {
  const errors = { ...totals.errors };
  for (const [key, count] of Object.entries(state.errors)) errors[key] = (errors[key] ?? 0) + count;
  return { reps: totals.reps + state.reps, badReps: totals.badReps + state.badReps, holdMs: totals.holdMs + state.holdMs, errors };
}

/** Skeleton over the video: face points skipped, joints red when a check fails. */
function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, lm: Landmarks | null, failing: number[], judged: boolean) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!lm) return;
  const seen = (index: number) => index >= 11 && (lm[index]?.visibility ?? 1) >= 0.5;
  const bad = new Set(failing);
  context.lineWidth = Math.max(3, width / 280);
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  for (const { start, end } of POSE_CONNECTIONS) {
    if (!seen(start) || !seen(end)) continue;
    context.beginPath();
    context.moveTo(lm[start].x * width, lm[start].y * height);
    context.lineTo(lm[end].x * width, lm[end].y * height);
    context.stroke();
  }
  lm.forEach((point, index) => {
    if (!seen(index)) return;
    context.beginPath();
    context.fillStyle = bad.has(index) ? BAD : judged ? OK : NEUTRAL;
    context.arc(point.x * width, point.y * height, bad.has(index) ? width / 80 : width / 150, 0, Math.PI * 2);
    context.fill();
  });
}

const PoseCoach: FunctionComponent<PoseCoachProps> = ({ exercise, rule, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef(0);
  const trackerRef = useRef<Tracker | null>(null);
  const liveRef = useRef<TrackerState | null>(null);
  const setRef = useRef(1);
  const totalsRef = useRef<Totals>(EMPTY);
  const [phase, setPhase] = useState<Phase>('setup');
  const [problem, setProblem] = useState<Problem>('other');
  const [live, setLive] = useState<TrackerState | null>(null);
  const [set, setSet] = useState(1);
  const [totals, setTotals] = useState<Totals>(EMPTY);
  const [flash, setFlash] = useState('');
  const [personSeen, setPersonSeen] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(''), 3000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const finish = useCallback(() => {
    if (liveRef.current) totalsRef.current = add(totalsRef.current, liveRef.current);
    liveRef.current = null;
    setTotals(totalsRef.current);
    stop();
    setPhase('done');
  }, [stop]);

  const completeSet = useCallback(
    (state: TrackerState) => {
      if (setRef.current >= SETS) {
        finish();
        return;
      }
      totalsRef.current = add(totalsRef.current, state);
      setTotals(totalsRef.current);
      setFlash(`¡Serie ${setRef.current} completa! Respirá y seguí con la ${setRef.current + 1}.`);
      setRef.current += 1;
      setSet(setRef.current);
      trackerRef.current?.reset();
      liveRef.current = null;
    },
    [finish],
  );

  const loop = useCallback(
    (landmarker: PoseLandmarker) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      let lastVideoTime = -1;
      let lastPaint = 0;
      const tick = () => {
        frameRef.current = requestAnimationFrame(tick);
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const now = performance.now();
        const lm = landmarker.detectForVideo(video, now).landmarks[0] ?? null;
        const tracker = trackerRef.current;
        const state = tracker ? tracker.update(lm, now) : null;
        liveRef.current = state;
        draw(canvas, video, lm, state?.failing ?? [], !!tracker);
        if (now - lastPaint > 100) {
          lastPaint = now;
          setLive(state);
          if (lm) setPersonSeen(true);
        }
        if (state && rule && isSetDone(rule, state)) completeSet(state);
      };
      tick();
    },
    [rule, completeSet],
  );

  async function start() {
    if (!window.isSecureContext) {
      setProblem('insecure');
      setPhase('error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('nocamera');
      setPhase('error');
      return;
    }
    setPhase('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (error) {
      setProblem(problemOf(error));
      setPhase('error');
      return;
    }
    streamRef.current = stream;
    try {
      await loadLandmarker();
    } catch {
      stop();
      setProblem('model');
      setPhase('error');
      return;
    }
    if (streamRef.current !== stream) return;
    trackerRef.current = rule ? createTracker(rule) : null;
    liveRef.current = null;
    setRef.current = 1;
    totalsRef.current = EMPTY;
    setSet(1);
    setTotals(EMPTY);
    setLive(null);
    setPersonSeen(false);
    setPhase('live');
  }

  useEffect(() => {
    if (phase !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    let cancelled = false;
    video
      .play()
      .then(() => loadLandmarker())
      .then((landmarker) => {
        if (!cancelled) loop(landmarker);
      })
      .catch(() => {
        if (cancelled) return;
        stop();
        setProblem('other');
        setPhase('error');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [phase, loop, stop]);

  function exit() {
    stop();
    onExit();
  }

  if (phase === 'error') {
    const { title, text } = PROBLEMS[problem];
    return (
      <section className={styles.card} role="alert">
        <p className={styles.kicker}>{exercise.name}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start}>
            Reintentar
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Elegir otro ejercicio
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'setup' || phase === 'starting') {
    return (
      <section className={styles.card} aria-labelledby="coach-titulo">
        <p className={styles.kicker}>PREPARATE</p>
        <h1 id="coach-titulo" className={styles.title}>
          {exercise.name}
        </h1>
        <ul className={styles.list}>
          <li>{rule ? rule.setup : 'Ubicá la cámara a 2–3 metros, que se te vea el cuerpo entero.'}</li>
          <li>Buena luz de frente, nada brillante detrás tuyo.</li>
          <li>El video se analiza en esta compu: no se graba ni se sube.</li>
          {rule ? <li>{SETS} series de {rule.mode === 'reps' ? `${rule.target} repeticiones` : `${rule.target} segundos`}. Las repeticiones mal hechas no cuentan.</li> : <li>Este ejercicio no tiene corrección todavía: vas a ver tu esqueleto en vivo.</li>}
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start} disabled={phase === 'starting'}>
            <Icon name="camera" /> {phase === 'starting' ? 'Abriendo cámara…' : 'Activar cámara'}
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Volver
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'done') {
    const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
    return (
      <section className={styles.card} aria-labelledby="resumen-titulo">
        <p className={styles.kicker}>RESUMEN</p>
        <h1 id="resumen-titulo" className={styles.title}>
          {exercise.name}
        </h1>
        {rule ? (
          <div className={styles.summary}>
            {rule.mode === 'reps' ? (
              <div className={styles.stat}>
                <span className={styles.statValue}>{totals.reps}</span>
                <span className={styles.statLabel}>repeticiones bien hechas</span>
              </div>
            ) : (
              <div className={styles.stat}>
                <span className={styles.statValue}>{Math.round(totals.holdMs / 1000)} s</span>
                <span className={styles.statLabel}>en buena postura</span>
              </div>
            )}
            {rule.mode === 'reps' ? (
              <div className={styles.stat}>
                <span className={styles.statValue}>{totals.badReps}</span>
                <span className={styles.statLabel}>para corregir</span>
              </div>
            ) : null}
            <div className={styles.stat}>
              <span className={styles.statValue}>{worst ? worst[1] : 0}</span>
              <span className={styles.statLabel}>{worst ? `veces: «${worst[0]}»` : 'correcciones'}</span>
            </div>
          </div>
        ) : (
          <p className={styles.text}>Sesión terminada.</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={start}>
            Otra vez
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Elegir otro ejercicio
          </button>
        </div>
      </section>
    );
  }

  const target = rule?.target ?? 0;
  const count = rule && live ? (rule.mode === 'reps' ? live.reps : Math.floor(live.holdMs / 1000)) : 0;
  const fill = rule && live ? (rule.mode === 'reps' ? live.progress : Math.min(1, live.holdMs / (rule.target * 1000))) : 0;
  const framing = !rule ? !personSeen : !live || live.status === 'framing';

  return (
    <section className={styles.stage} aria-label={`Entrenando: ${exercise.name}`}>
      <div className={styles.videoWrap}>
        <video ref={videoRef} className={styles.video} muted playsInline />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {framing ? <p className={styles.framing}>{live?.message ?? 'Buscándote… ubicate frente a la cámara.'}</p> : null}
        {flash ? <p className={styles.flash}>{flash}</p> : null}
      </div>

      <aside className={styles.panel}>
        <p className={styles.kicker}>{exercise.name}</p>
        {rule ? (
          <>
            <p className={styles.setLabel}>
              SERIE {set}/{SETS}
            </p>
            <p className={styles.count} aria-live="polite">
              {count}
              <span className={styles.target}>
                /{target}
                {rule.mode === 'hold' ? ' s' : ''}
              </span>
            </p>
            <div className={styles.bar} aria-hidden="true">
              <div className={styles.barFill} style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
            <p className={`${styles.message} ${styles[live?.tone ?? 'info']}`} aria-live="polite">
              {live?.message ?? 'Ubicate frente a la cámara.'}
            </p>
            {rule.mode === 'reps' ? <p className={styles.stats}>Para corregir en esta serie: {live?.badReps ?? 0}</p> : null}
          </>
        ) : (
          <p className={`${styles.message} ${styles.info}`}>Análisis de postura todavía no disponible para este ejercicio. Mirá tu esqueleto para controlar el movimiento.</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={finish}>
            Terminar
          </button>
          <button type="button" className={styles.secondary} onClick={exit}>
            Salir
          </button>
        </div>
      </aside>
    </section>
  );
};

export default PoseCoach;
```

<!-- file: src/components/organisms/PoseCoach/PoseCoach.module.css -->
```css
.card {
  	max-width: 760px;
  	display: flex;
  	flex-direction: column;
  	gap: 20px;
  	padding: clamp(20px, 4vw, 40px);
  	background-color: #111;
  	border: 1px solid #2a2a2a;
  	color: #fff;
  	font-family: Inter;
}
.kicker {
  	margin: 0;
  	font-size: 11px;
  	letter-spacing: 0.2em;
  	color: #ff7900;
  	font-weight: 600;
  	text-transform: uppercase;
}
.title {
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: clamp(40px, 6vw, 72px);
  	line-height: 0.95;
  	text-transform: uppercase;
}
.text {
  	margin: 0;
  	font-size: 15px;
  	line-height: 1.6;
  	color: #c9cad0;
}
.list {
  	margin: 0;
  	padding-left: 20px;
  	display: flex;
  	flex-direction: column;
  	gap: 10px;
  	font-size: 15px;
  	line-height: 1.5;
  	color: #d9dae0;
}
.actions {
  	display: flex;
  	flex-wrap: wrap;
  	gap: 12px;
}
.primary,
.secondary {
  	display: inline-flex;
  	align-items: center;
  	justify-content: center;
  	gap: 10px;
  	height: 52px;
  	padding: 0 24px;
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 20px;
  	text-transform: uppercase;
  	letter-spacing: 0.04em;
}
.primary {
  	background-color: #ff7900;
  	color: #080808;
}
.primary:hover {
  	filter: brightness(1.08);
}
.primary:disabled {
  	opacity: 0.6;
  	cursor: progress;
}
.secondary {
  	border: 1px solid #3a3a3a;
  	color: #fff;
}
.secondary:hover {
  	border-color: #ff7900;
}
.stage {
  	display: grid;
  	grid-template-columns: minmax(0, 1fr) 340px;
  	gap: 20px;
  	align-items: start;
  	color: #fff;
  	font-family: Inter;
}
.videoWrap {
  	position: relative;
  	background-color: #000;
  	min-height: 240px;
}
.video,
.canvas {
  	display: block;
  	width: 100%;
  	transform: scaleX(-1);
}
.canvas {
  	position: absolute;
  	inset: 0;
  	height: 100%;
}
.framing,
.flash {
  	position: absolute;
  	left: 12px;
  	right: 12px;
  	margin: 0;
  	padding: 12px 14px;
  	font-size: 15px;
  	font-weight: 600;
}
.framing {
  	top: 12px;
  	background-color: rgba(8, 8, 8, 0.85);
  	border-left: 4px solid #ff7900;
}
.flash {
  	bottom: 12px;
  	background-color: #ff7900;
  	color: #080808;
}
.panel {
  	display: flex;
  	flex-direction: column;
  	gap: 16px;
  	padding: 20px;
  	background-color: #111;
  	border: 1px solid #2a2a2a;
}
.setLabel {
  	margin: 0;
  	font-size: 12px;
  	letter-spacing: 0.16em;
  	color: #a7a9b2;
}
.count {
  	margin: 0;
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 120px;
  	line-height: 0.9;
}
.target {
  	font-size: 32px;
  	color: #8a8c94;
  	margin-left: 6px;
}
.bar {
  	height: 8px;
  	background-color: #232323;
}
.barFill {
  	height: 100%;
  	background-color: #ff7900;
  	transition: width 0.15s linear;
}
.message {
  	margin: 0;
  	padding: 12px 14px;
  	font-size: 17px;
  	font-weight: 600;
  	line-height: 1.4;
  	border-left: 4px solid;
}
.ok {
  	border-color: #3ddc84;
  	background-color: rgba(61, 220, 132, 0.1);
}
.warn {
  	border-color: #ff3b30;
  	background-color: rgba(255, 59, 48, 0.12);
}
.info {
  	border-color: #ff7900;
  	background-color: rgba(255, 121, 0, 0.08);
}
.stats {
  	margin: 0;
  	font-size: 13px;
  	color: #a7a9b2;
}
.summary {
  	display: grid;
  	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  	gap: 12px;
}
.stat {
  	display: flex;
  	flex-direction: column;
  	gap: 6px;
  	padding: 16px;
  	border: 1px solid #2a2a2a;
}
.statValue {
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 56px;
  	line-height: 1;
  	color: #ff7900;
}
.statLabel {
  	font-size: 13px;
  	line-height: 1.4;
  	color: #c9cad0;
}
@media (max-width: 899px) {
  	.stage {
    		grid-template-columns: minmax(0, 1fr);
  	}
  	.count {
    		font-size: 88px;
  	}
}
@media (prefers-reduced-motion: reduce) {
  	.barFill {
    		transition: none;
  	}
}
```

- [ ] **Step 2: Página**

<!-- file: src/pages/Entrenar.tsx -->
```tsx
import { FunctionComponent, useEffect, useState } from 'react';
import { Icon } from '../components/atoms';
import { ExerciseCatalog, PoseCoach } from '../components/organisms';
import { ruleFor } from '../lib/exercises/match';
import type { Exercise } from '../lib/wger';
import styles from './Entrenar.module.css';

const Entrenar: FunctionComponent = () => {
  const [exercise, setExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Entrená con cámara — SPOT';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [exercise]);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <a href="#inicio" className={styles.back}>
          <Icon name="arrowLeft" size={18} /> SPOT
        </a>
        <span className={styles.section}>Entrená con cámara</span>
      </header>
      <main className={styles.main}>
        {exercise ? <PoseCoach key={exercise.id} exercise={exercise} rule={ruleFor(exercise.name)} onExit={() => setExercise(null)} /> : <ExerciseCatalog onStart={setExercise} />}
      </main>
    </div>
  );
};

export default Entrenar;
```

<!-- file: src/pages/Entrenar.module.css -->
```css
.page {
  	min-height: 100vh;
  	background-color: #080808;
  	color: #fff;
  	font-family: Inter;
}
.bar {
  	position: sticky;
  	top: 0;
  	z-index: 10;
  	display: flex;
  	align-items: center;
  	justify-content: space-between;
  	gap: 16px;
  	height: 64px;
  	padding: 0 clamp(16px, 4vw, 48px);
  	background-color: rgba(8, 8, 8, 0.92);
  	border-bottom: 1px solid #1f1f1f;
  	backdrop-filter: blur(8px);
}
.back {
  	display: inline-flex;
  	align-items: center;
  	gap: 8px;
  	font-family: 'Barlow Condensed';
  	font-weight: 800;
  	font-size: 24px;
  	letter-spacing: 0.04em;
}
.back:hover {
  	color: #ff7900;
}
.section {
  	font-size: 12px;
  	letter-spacing: 0.16em;
  	text-transform: uppercase;
  	color: #a7a9b2;
}
.main {
  	max-width: 1440px;
  	margin: 0 auto;
  	padding: clamp(24px, 4vw, 56px) clamp(16px, 4vw, 48px) 80px;
}
```

- [ ] **Step 3: Export** — `organisms/index.ts`: `export { default as PoseCoach } from './PoseCoach/PoseCoach';`.

- [ ] **Step 4: Verificar** — `npm test` (PASS) y `npm run build` (sin errores de TypeScript; aparece un chunk separado `Entrenar-*.js`).

- [ ] **Step 5: Commit** — `feat(entrenar): coach de postura con cámara y página Entrenar`

---

### Task 8: Verificación en el navegador

- [ ] **Step 1:** `npm run dev` y abrir `http://localhost:5173/#entrenar`.
- [ ] **Step 2:** El catálogo muestra los 8 ejercicios de Ritmo-Vida al instante y, al cargar wger, suma los que tienen análisis ("Postura"). Desactivar el filtro muestra cientos.
- [ ] **Step 3:** Buscar "sentadilla", chip "Abdomen", abrir detalle, "Empezar con cámara" → pantalla de preparación.
- [ ] **Step 4:** Con la cámara negada (permiso bloqueado) aparece "Sin permiso para la cámara" con "Reintentar".
- [ ] **Step 5:** Ancho 375 px: sin scroll horizontal, detalle como panel inferior.
- [ ] **Step 6:** Desde la landing, el botón "Entrená con cámara" lleva a `#entrenar`; "← SPOT" vuelve.
- [ ] **Step 7 (manual, usuario):** frente a la webcam, hacer sentadillas: cuenta reps, avisa "Bajá más" y "Mantené el pecho arriba".
```
