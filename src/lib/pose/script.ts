import { FRAMING, type TrackerState } from './engine';
import type { PoseRule } from './rules';

/** What the coach says out loud. `urgent` cuts whatever is being said. */
export type Line = { text: string; urgent: boolean };
export type Narrator = { update: (state: TrackerState, now: number) => Line | null; reset: () => void };

const WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
const word = (n: number) => WORDS[n] ?? String(n);

const SAME_WORDS_MS = 6000;
const FRAMING_MS = 10_000;

/** Symbols the speech engines read badly. */
export function forSpeech(text: string): string {
  return text.replace(/\s*[–—]\s*/g, ' a ').replace(/°/g, ' grados').replace(/\s+/g, ' ').trim();
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

  function reset() {
    seen = false;
    reps = 0;
    badReps = 0;
    tens = 0;
    lastCall = false;
    spoken = {};
  }

  /** Same words again only after a pause, so a held mistake is not nagged every frame. */
  function fresh(text: string, now: number, wait = SAME_WORDS_MS) {
    const before = spoken[text];
    if (before !== undefined && now - before < wait) return false;
    spoken[text] = now;
    return true;
  }

  function update(state: TrackerState, now: number): Line | null {
    if (state.status === 'framing') {
      if (state.tone === 'warn' && state.message === FRAMING && fresh(FRAMING, now, FRAMING_MS)) return { text: FRAMING, urgent: false };
      return null;
    }

    if (!seen) {
      seen = true;
      return { text: rule?.mode === 'hold' ? 'Te veo. Ponete en posición y sostené.' : 'Te veo. Cuando quieras, empezá.', urgent: false };
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
      return fresh(state.message, now) ? { text: state.message, urgent: true } : null;
    }

    if (state.reps > reps) {
      reps = state.reps;
      if (reps % 5 === 0) return { text: `${word(reps)}. ¡Muy bien!`, urgent: false };
      if (rule?.mode === 'reps' && rule.target > 1 && reps === rule.target - 1) return { text: `${word(reps)}. ¡Una más!`, urgent: false };
      return { text: word(reps), urgent: false };
    }

    if (state.tone === 'warn' && state.message && fresh(state.message, now)) return { text: state.message, urgent: true };

    if (rule?.mode === 'hold') {
      const seconds = Math.floor(state.holdMs / 1000);
      if (Math.floor(seconds / 10) > tens) {
        tens = Math.floor(seconds / 10);
        return { text: seconds % 10 === 0 ? `${word(seconds)} segundos` : `${seconds} segundos`, urgent: false };
      }
      if (!lastCall && seconds >= rule.target - 5 && seconds < rule.target) {
        lastCall = true;
        return { text: '¡Cinco segundos más!', urgent: false };
      }
    }

    return null;
  }

  return { update, reset };
}

type Describable = { name: string; lines: string[] };

/** Read when the setup screen opens: what it is, where to put the camera, how many sets, the first steps. */
export function introText(exercise: Describable, rule: PoseRule | null, sets: number): string {
  const parts = [`${exercise.name}.`];
  if (rule) {
    parts.push(rule.setup);
    parts.push(`Vamos a hacer ${sets} series de ${rule.mode === 'reps' ? `${rule.target} repeticiones` : `${rule.target} segundos`}.`);
  } else {
    parts.push('Ubicá la cámara a dos o tres metros, que se te vea el cuerpo entero.', 'Este ejercicio todavía no tiene corrección: vas a ver tu esqueleto.');
  }
  const steps = exercise.lines.filter((line) => line.length < 140).slice(0, 3);
  if (steps.length > 0) parts.push('Cómo se hace:', ...steps);
  parts.push('Cuando estés listo, activá la cámara.');
  return forSpeech(parts.join(' '));
}

export function setDoneText(set: number, sets: number): string {
  return set >= sets ? `Serie ${set} lista.` : `Serie ${set} lista. Respirá y seguí con la ${set + 1}.`;
}

type Totals = { reps: number; badReps: number; holdMs: number; errors: Record<string, number> };

export function summaryText(rule: PoseRule | null, totals: Totals): string {
  if (!rule) return 'Terminaste. Buen trabajo.';
  const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
  const learned = worst ? ` Lo que más te costó: ${worst[0]}` : '';
  if (rule.mode === 'hold') return `Terminaste. ${Math.round(totals.holdMs / 1000)} segundos en buena postura.${learned}`;
  return `Terminaste. ${totals.reps} repeticiones bien hechas y ${totals.badReps} para corregir.${learned}`;
}
