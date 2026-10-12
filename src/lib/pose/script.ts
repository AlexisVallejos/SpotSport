import { FRAMING, type TrackerState } from './engine';
import type { PoseRule } from './rules';

/** What the coach says out loud. `urgent` cuts whatever is being said. */
export type Line = { text: string; urgent: boolean };
export type Narrator = { update: (state: TrackerState, now: number) => Line | null; reset: () => void };

const WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
const ORDINALS = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta'];
const word = (n: number) => WORDS[n] ?? String(n);

const SAME_WORDS_MS = 6000;
const FRAMING_MS = 10_000;

// A teacher does not repeat the same sentence every time: these rotate, in order.
export const CHEERS = ['¡Muy bien!', '¡Eso es!', '¡Así, bárbaro!', '¡Buenísimo!'];
const LAST_REP = ['¡Una más y listo!', '¡Una más, dale!'];
const HOLD_CHEERS = ['Aguantá, vas bien.', 'Muy bien, no aflojes.', 'Así, seguí así.'];

/** Spoken versions (voseo, argentinismos) of the on-screen corrections. Anything missing is read as written. */
export const CORRECTIONS: Record<string, string[]> = {
  [FRAMING]: ['Alejate un poquito, que no te veo entero.', 'Pará, alejate un poco que no entrás en la cámara.'],
  'Mantené el pecho arriba.': ['Pecho arriba, que se te cae.', 'Ojo con el pecho, mantenelo arriba.'],
  'Bajá más: muslos paralelos al piso.': ['Bajá un poco más, hasta que los muslos queden paralelos al piso.', 'Dale, bajá más, que no llegaste.'],
  'Bajá más: la rodilla de atrás cerca del piso.': ['Bajá más, que la rodilla de atrás casi toque el piso.', 'Dale, bajá un poco más.'],
  'Torso erguido.': ['Torso derecho, no te inclines.', 'Subí el pecho, quedate bien derecho.'],
  'Bajá el pecho más cerca del piso.': ['Bajá más el pecho, casi hasta el piso.', 'Dale, bajá un poco más.'],
  'Cuerpo recto: alineá la cadera.': ['Cuerpo derecho, como una tabla. Alineá la cadera.', 'Ojo con la cadera, que quede en línea.'],
  'Ponete en posición: cuerpo horizontal.': ['Ponete en posición, con el cuerpo bien horizontal.'],
  'Subí la cadera.': ['Subí un poco la cadera, que se te cae.', 'Cadera arriba, dale.'],
  'Bajá la cadera.': ['Bajá un poco la cadera, que la tenés muy alta.', 'Bajá esa cadera, dale.'],
  'No dejes caer la cadera.': ['No dejes caer la cadera, aguantá.', 'Cadera arriba, no la sueltes.'],
  'Bajá un poco la cadera.': ['Bajá un poquito la cadera.'],
  'Subí más la cadera, hasta alinearla con hombros y rodillas.': ['Subí más la cadera, hasta quedar en línea con hombros y rodillas.', 'Dale, empujá más con la cadera.'],
  'Subí las piernas hasta casi 90°.': ['Subí las piernas, hasta casi noventa grados.', 'Dale, subilas un poco más.'],
  'Piernas más estiradas.': ['Estirá más las piernas.', 'Piernas bien estiradas, che.'],
  'Elevá más la pierna, hasta la altura de la cadera.': ['Subí más la pierna, hasta la altura de la cadera.', 'Dale, elevá un poco más esa pierna.'],
};

/** Symbols and ranges the speech engines read badly. */
export function forSpeech(text: string): string {
  return text
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 o $2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/°/g, ' grados')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decides, frame by frame, what a teacher would say: the count, the correction, the encouragement.
 * Pure (no audio, no DOM): the page feeds it tracker states and plays what comes back.
 */
export function createNarrator(rule: PoseRule | null): Narrator {
  let seen = false;
  let reps = 0;
  let badReps = 0;
  let tens = 0;
  let lastCall = false;
  let spoken: Record<string, number> = {};
  let used: Record<string, number> = {};

  function reset() {
    seen = false;
    reps = 0;
    badReps = 0;
    tens = 0;
    lastCall = false;
    spoken = {};
    used = {};
  }

  /** Same words again only after a pause, so a held mistake is not nagged every frame. */
  function fresh(text: string, now: number, wait = SAME_WORDS_MS) {
    const before = spoken[text];
    if (before !== undefined && now - before < wait) return false;
    spoken[text] = now;
    return true;
  }

  /** The next variant of a list, so the same situation does not always sound the same. */
  function rotate(key: string, options: string[]) {
    const index = used[key] ?? 0;
    used[key] = index + 1;
    return options[index % options.length];
  }

  function correction(message: string) {
    const options = CORRECTIONS[message];
    return options ? rotate(message, options) : message;
  }

  function update(state: TrackerState, now: number): Line | null {
    if (state.status === 'framing') {
      if (state.tone === 'warn' && state.message === FRAMING && fresh(FRAMING, now, FRAMING_MS)) return { text: correction(FRAMING), urgent: false };
      return null;
    }

    if (!seen) {
      seen = true;
      return { text: rule?.mode === 'hold' ? 'Dale, ya te veo. Ponete en posición y aguantá.' : 'Dale, ya te veo. Cuando quieras, arrancá.', urgent: false };
    }

    // A new set resets the tracker: counters go back to zero without announcing anything.
    if (state.reps < reps) reps = state.reps;
    if (state.badReps < badReps) badReps = state.badReps;
    if (state.holdMs < tens * 10_000) {
      tens = Math.floor(state.holdMs / 10_000);
      lastCall = false;
    }

    if (state.badReps > badReps) {
      badReps = state.badReps;
      return fresh(state.message, now) ? { text: correction(state.message), urgent: true } : null;
    }

    if (state.reps > reps) {
      reps = state.reps;
      if (reps % 5 === 0) return { text: `${word(reps)}. ${rotate('cheer', CHEERS)}`, urgent: false };
      if (rule?.mode === 'reps' && rule.target > 1 && reps === rule.target - 1) return { text: `${word(reps)}. ${rotate('last', LAST_REP)}`, urgent: false };
      return { text: word(reps), urgent: false };
    }

    if (state.tone === 'warn' && state.message && fresh(state.message, now)) return { text: correction(state.message), urgent: true };

    if (rule?.mode === 'hold') {
      const seconds = Math.floor(state.holdMs / 1000);
      if (Math.floor(seconds / 10) > tens) {
        tens = Math.floor(seconds / 10);
        return { text: `${word(seconds)} segundos. ${rotate('hold', HOLD_CHEERS)}`, urgent: false };
      }
      if (!lastCall && seconds >= rule.target - 5 && seconds < rule.target) {
        lastCall = true;
        return { text: '¡Cinco segundos más, aguantá!', urgent: false };
      }
    }

    return null;
  }

  return { update, reset };
}

type Describable = { name: string; lines: string[] };

/** Read when the setup screen opens: what it is, where to put the camera, how many sets, the first steps. */
export function introText(exercise: Describable, rule: PoseRule | null, sets: number): string {
  const parts = [`Dale, vamos con ${exercise.name}.`];
  if (rule) {
    parts.push(rule.setup);
    parts.push(`Hacemos ${word(sets)} series de ${word(rule.target)} ${rule.mode === 'reps' ? 'repeticiones' : 'segundos'}.`);
  } else {
    parts.push('Ubicá la cámara a dos o tres metros, que se te vea el cuerpo entero.', 'Este ejercicio todavía no tiene corrección: vas a ver tu esqueleto.');
  }
  const steps = exercise.lines.filter((line) => line.length < 140).slice(0, 3);
  if (steps.length > 0) parts.push('Fijate cómo va:', ...steps);
  parts.push('Cuando estés listo, activá la cámara y arrancamos.');
  return forSpeech(parts.join(' '));
}

export function setDoneText(set: number, sets: number): string {
  if (set >= sets) return `Muy bien, serie ${word(set)} lista.`;
  return `Muy bien, serie ${word(set)} lista. Respirá un poquito y vamos con la ${ORDINALS[set + 1] ?? 'siguiente'}.`;
}

type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

export function summaryText(rule: PoseRule | null, totals: Totals): string {
  if (!rule) return 'Listo, terminaste. Buen trabajo.';
  const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
  const learned = worst ? ` Lo que más te costó: ${worst[0]}` : '';
  if (rule.mode === 'hold') return `Listo, terminaste. Aguantaste ${Math.round(totals.holdMs / 1000)} segundos en buena postura.${learned}`;
  return `Listo, terminaste. ${totals.reps} repeticiones bien hechas y ${totals.badReps} para corregir.${learned}`;
}
