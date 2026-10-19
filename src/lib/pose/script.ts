import { FRAMING, type TrackerState } from './engine';
import { CENTER, CLOSER, NO_PERSON } from './framing';
import type { PoseRule } from './rules';

/** What the coach says out loud. `urgent` cuts whatever is being said. */
export type Line = { text: string; urgent: boolean };
export type Narrator = { update: (state: TrackerState, now: number) => Line | null; reset: () => void };

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

/** Spanish number words for 0–99 ("veinticuatro", "treinta y uno"); `feminine` turns "uno" into "una". */
export function numberWords(n: number, feminine = false): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  const text = n < 30 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNITS[n % 10]}` : '');
  return feminine ? text.replace(/uno$/, 'una') : text;
}

const word = (n: number) => numberWords(n);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Default sets per session (the person can choose 1–5). */
export const SETS = 3;

// A coach who talks all the time is tiring: few words, spaced out. The count is big on screen, so it is not read out.
/** Minimum time between two spoken lines (set boundaries and the summary are exempt). */
const MIN_GAP_MS = 4500;
const SAME_WORDS_MS = 10_000;
const FRAMING_MS = 15_000;
/** Right after the camera turns on the person is still at the keyboard: "I can't see you" would be premature. */
const NO_PERSON_GRACE_MS = 6000;
const HOLD_WARN_MS = 12_000;

export const CHEERS = ['¡Muy bien!', '¡Eso es!', '¡Así, bárbaro!', '¡Buenísimo!'];
export const LAST_REP = ['¡Una más!', 'Una más, dale.'];
export const SEEN = 'Dale, ya te veo.';
export const REST_END = 'Dale, arrancamos.';
export const PLACE_SIDE = 'Ponete de costado a la cámara.';
export const PLACE_FRONT = 'Ponete de frente a la cámara.';
export const PLACE_ANY = 'Ubicate para que se te vea entero.';

/** Spoken versions (voseo, argentinismos) of the on-screen corrections: short, one idea. Anything missing is read as written. */
export const CORRECTIONS: Record<string, string[]> = {
  [FRAMING]: ['Alejate un poco.', 'Pará, alejate un poquito.'],
  [NO_PERSON]: ['No te veo.', 'No te veo, ubicate en cámara.'],
  [CENTER]: ['Correte al centro.', 'Un poco más al centro.'],
  [CLOSER]: ['Acercate un poco.', 'Acercate un poquito.'],
  'Ponete de costado a la cámara.': ['Ponete de costado a la cámara.', 'Girate, de costado.'],
  'Mantené el pecho arriba.': ['Pecho arriba.', 'Subí el pecho.'],
  'Bajá más: muslos paralelos al piso.': ['Bajá un poco más.', 'Dale, más abajo.'],
  'Bajá más: la rodilla de atrás cerca del piso.': ['Bajá un poco más.', 'Más abajo, dale.'],
  'Torso erguido.': ['Torso derecho.', 'Subí el pecho.'],
  'Bajá el pecho más cerca del piso.': ['Bajá un poco más.', 'Más cerca del piso.'],
  'Cuerpo recto: alineá la cadera.': ['Cuerpo derecho.', 'Alineá la cadera.'],
  'Ponete en posición: cuerpo horizontal.': ['Ponete en posición.'],
  'Subí la cadera.': ['Subí la cadera.', 'Cadera arriba.'],
  'Bajá la cadera.': ['Bajá la cadera.', 'Un poco más abajo.'],
  'No dejes caer la cadera.': ['No dejes caer la cadera.', 'Cadera arriba.'],
  'Bajá un poco la cadera.': ['Bajá un poquito la cadera.'],
  'Subí más la cadera, hasta alinearla con hombros y rodillas.': ['Subí más la cadera.', 'Dale, empujá más.'],
  'Subí las piernas hasta casi 90°.': ['Subí más las piernas.', 'Dale, un poco más.'],
  'Piernas más estiradas.': ['Estirá las piernas.', 'Piernas estiradas.'],
  'Elevá más la pierna, hasta la altura de la cadera.': ['Subí más la pierna.', 'Un poco más arriba.'],
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

/** Splits a line into sentences: each one is a clip of the voice pack. */
export function splitSentences(text: string): string[] {
  return forSpeech(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The key a sentence has in the voice pack: its spoken text without the final full stop. */
export function clipKey(sentence: string): string {
  return sentence.trim().replace(/\.$/, '');
}

/**
 * Decides, frame by frame, what a coach would say — and mostly keeps quiet.
 * It speaks: that it sees you (once), a correction after a bad repetition, "one more", a check-in every five reps,
 * the seconds of a hold. Pure (no audio, no DOM): the page feeds it tracker states and plays what comes back.
 */
export function createNarrator(rule: PoseRule | null): Narrator {
  let seen = false;
  let reps = 0;
  let badReps = 0;
  let tens = 0;
  let spoken: Record<string, number> = {};
  let used: Record<string, number> = {};
  let lastLine = -Infinity;
  let startedAt: number | null = null;

  function reset() {
    startedAt = null;
    seen = false;
    reps = 0;
    badReps = 0;
    tens = 0;
    spoken = {};
    used = {};
    lastLine = -Infinity;
  }

  /** The same words again only after a pause. */
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

  /** A line is only said if the coach has not just spoken. */
  function say(text: string, now: number): Line {
    lastLine = now;
    return { text, urgent: false };
  }
  const quiet = (now: number) => now - lastLine < MIN_GAP_MS;

  function update(state: TrackerState, now: number): Line | null {
    startedAt ??= now;
    if (state.status === 'framing') {
      // Framing advice is spoken only when it has a spoken version, and not again for a while.
      const early = state.message === NO_PERSON && now - startedAt < NO_PERSON_GRACE_MS;
      if (state.tone === 'warn' && CORRECTIONS[state.message] && !early && !quiet(now) && fresh(state.message, now, FRAMING_MS)) return say(correction(state.message), now);
      return null;
    }

    if (!seen) {
      seen = true;
      return say(SEEN, now);
    }

    // A new set resets the tracker: counters go back to zero without announcing anything.
    if (state.reps < reps) reps = state.reps;
    if (state.badReps < badReps) badReps = state.badReps;
    if (state.holdMs < tens * 10_000) tens = Math.floor(state.holdMs / 10_000);

    if (state.badReps > badReps) {
      badReps = state.badReps;
      return !quiet(now) && fresh(state.message, now) ? say(correction(state.message), now) : null;
    }

    if (state.reps > reps) {
      reps = state.reps;
      if (quiet(now)) return null;
      if (rule?.mode === 'reps' && rule.target > 1 && reps === rule.target - 1) return say(rotate('last', LAST_REP), now);
      if (reps % 10 === 0) return say(`${word(reps)}. ${rotate('cheer', CHEERS)}`, now);
      if (reps % 5 === 0) return say(word(reps), now);
      return null;
    }

    if (rule?.mode === 'hold') {
      if (state.tone === 'warn' && state.message && !quiet(now) && fresh(state.message, now, HOLD_WARN_MS)) return say(correction(state.message), now);
      const seconds = Math.floor(state.holdMs / 1000);
      if (Math.floor(seconds / 10) > tens) {
        tens = Math.floor(seconds / 10);
        return say(`${word(seconds)} segundos.`, now);
      }
    }

    return null;
  }

  return { update, reset };
}

/**
 * Read when the setup screen opens: two short sentences, what we are doing and where to stand. Distance, steps
 * and the number of sets are on screen and in the 3D demo, so they are not read. It never includes names or texts that come from outside,
 * so every sentence can be recorded ahead of time.
 */
export function introText(rule: PoseRule | null): string {
  if (!rule) return forSpeech(`Vamos. ${PLACE_ANY}`);
  const name = `${rule.name.charAt(0).toLowerCase()}${rule.name.slice(1)}`;
  return forSpeech(`Vamos con ${name}. ${rule.view === 'side' ? PLACE_SIDE : PLACE_FRONT}`);
}

export function setDoneText(set: number, sets: number): string {
  if (set >= sets) return `Muy bien, serie ${word(set)} lista.`;
  return `Muy bien, serie ${word(set)} lista. Descansá.`;
}

/** What is said as the next set starts, naming it once so it is clear where you are. */
export function nextSetText(set: number): string {
  return `${REST_END} Serie ${word(set)}.`;
}

type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

/** Counts said during a set ("cinco", "diez"…): the target goes up to 30. */
export const COUNT_MAX = 40;
/** Totals in the summary: up to 5 sets of 20 fit in Spanish words below 100. */
export const SUMMARY_MAX = 99;

/** How long a hold lasted, the way a person would say it: seconds up to 95, then minutes and halves. */
function holdLine(seconds: number): string {
  if (seconds < 3) return 'Casi no aguantaste, probemos de nuevo.';
  if (seconds < 97.5) return `Aguantaste unos ${word(Math.max(5, Math.round(seconds / 5) * 5))} segundos.`;
  const halves = Math.round(seconds / 30);
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1 ? ' y medio' : '';
  return whole === 1 ? `Aguantaste un minuto${half}.` : `Aguantaste unos ${word(whole)} minutos${half}.`;
}

export function summaryText(rule: PoseRule | null, totals: Totals): string {
  if (!rule) return 'Listo, terminaste.';
  const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
  const learned = worst ? ` ${CORRECTIONS[worst[0]]?.[0] ?? worst[0]}` : '';
  if (rule.mode === 'hold') return `Listo, terminaste. ${holdLine(totals.holdMs / 1000)}${learned}`;
  const reps = Math.min(SUMMARY_MAX, totals.reps);
  const bad = Math.min(SUMMARY_MAX, totals.badReps);
  const good = reps === 0 ? 'Ninguna repetición bien hecha.' : reps === 1 ? 'Una repetición bien hecha.' : `${capital(numberWords(reps, true))} repeticiones bien hechas.`;
  const fix = bad === 0 ? '' : ` ${capital(numberWords(bad, true))} para corregir.`;
  return `Listo, terminaste. ${good}${fix}${learned}`;
}
