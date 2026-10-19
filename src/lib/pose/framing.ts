import { isVisible, type Landmarks } from './geometry';

// "Step back" is the right advice only sometimes. Looking at where the visible body is tells which one it is:
// nobody there, cut at an edge, too far to be seen well, or simply part of the body out of the picture.

export const NO_PERSON = 'No te veo: ponete frente a la cámara.';
export const STEP_BACK = 'Alejate un poco: necesito verte de la cabeza a los pies.';
export const CENTER = 'Correte al centro de la imagen.';
export const CLOSER = 'Acercate un poco a la cámara.';

/** Body parts as the person would name them, in head-to-toe order. */
const PARTS: [number[], string][] = [
  [[11, 12], 'hombros'],
  [[13, 14], 'codos'],
  [[15, 16], 'manos'],
  [[23, 24], 'cadera'],
  [[25, 26], 'rodillas'],
  [[27, 28], 'pies'],
];

/** Closer than this to an edge of the picture counts as cut by it. */
const EDGE = 0.03;
/** A body this short on screen is too far: MediaPipe guesses its joints instead of seeing them. */
const MIN_HEIGHT = 0.35;
const SEEN = 0.5;

export type Framing = { ok: boolean; message: string; missing: string[] };

/** Which body parts among `required` the camera does not see well enough. */
export function missingParts(lm: Landmarks | null, required: number[], min: number): string[] {
  const hidden = new Set(required.filter((index) => !lm || !isVisible(lm, index, min)));
  return PARTS.filter(([indices]) => indices.some((index) => hidden.has(index))).map(([, name]) => name);
}

/** Whether the person is framed well enough to judge, and if not, the one thing to do about it. */
export function checkFraming(lm: Landmarks | null, required: number[], min: number): Framing {
  const missing = missingParts(lm, required, min);
  if (!lm) return { ok: false, message: NO_PERSON, missing };
  if (missing.length === 0) return { ok: true, message: '', missing };

  const seen = lm.filter((point) => (point.visibility ?? 1) >= SEEN);
  if (seen.length === 0) return { ok: false, message: NO_PERSON, missing };
  const xs = seen.map((point) => point.x);
  const ys = seen.map((point) => point.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  if (Math.min(...xs) < EDGE || Math.max(...xs) > 1 - EDGE) return { ok: false, message: CENTER, missing };
  if (top < EDGE || bottom > 1 - EDGE) return { ok: false, message: STEP_BACK, missing };
  if (bottom - top < MIN_HEIGHT) return { ok: false, message: CLOSER, missing };
  return { ok: false, message: STEP_BACK, missing };
}
