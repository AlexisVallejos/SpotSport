import { describe, expect, it } from 'vitest';
import { FRAMING, type TrackerState } from './engine';
import { RULES } from './rules';
import { createNarrator, forSpeech, introText, setDoneText, summaryText } from './script';

const base: TrackerState = { status: 'active', reps: 0, badReps: 0, holdMs: 0, progress: 0, message: '', tone: 'info', failing: [], errors: {} };
const at = (patch: Partial<TrackerState>): TrackerState => ({ ...base, ...patch });

describe('createNarrator (reps)', () => {
  it('asks to step back once in a while, not on every frame', () => {
    const narrator = createNarrator(RULES.squat);
    const framing = at({ status: 'framing', tone: 'warn', message: FRAMING });
    expect(narrator.update(framing, 0)).toEqual({ text: FRAMING, urgent: false });
    expect(narrator.update(framing, 1000)).toBeNull();
    expect(narrator.update(framing, 11_000)).toEqual({ text: FRAMING, urgent: false });
  });

  it('stays quiet before the person shows up', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({ status: 'framing', tone: 'info', message: 'Empezá cuando quieras.' }), 0)).toBeNull();
  });

  it('says it sees you once, then counts', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({}), 0)?.text).toBe('Te veo. Cuando quieras, empezá.');
    expect(narrator.update(at({}), 33)).toBeNull();
    expect(narrator.update(at({ reps: 1, tone: 'ok', message: '¡Bien! Van 1.' }), 2000)).toEqual({ text: 'uno', urgent: false });
    expect(narrator.update(at({ reps: 2, tone: 'ok' }), 4000)?.text).toBe('dos');
  });

  it('cheers on multiples of five and warns before the last one', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({ reps: 4 }), 0);
    expect(narrator.update(at({ reps: 5 }), 1000)?.text).toBe('cinco. ¡Muy bien!');
    narrator.update(at({ reps: 8 }), 2000);
    expect(narrator.update(at({ reps: 9 }), 3000)?.text).toBe('nueve. ¡Una más!');
  });

  it('corrects a bad rep urgently, but not the same words twice in a row', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const bad = at({ badReps: 1, tone: 'warn', message: 'Bajá más: muslos paralelos al piso.' });
    expect(narrator.update(bad, 3000)).toEqual({ text: 'Bajá más: muslos paralelos al piso.', urgent: true });
    expect(narrator.update({ ...bad, badReps: 2 }, 5000)).toBeNull();
    expect(narrator.update({ ...bad, badReps: 3 }, 10_000)?.urgent).toBe(true);
  });

  it('warns live while the form is wrong', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const live = at({ tone: 'warn', message: 'Mantené el pecho arriba.' });
    expect(narrator.update(live, 1000)).toEqual({ text: 'Mantené el pecho arriba.', urgent: true });
    expect(narrator.update(live, 2000)).toBeNull();
  });

  it('keeps counting after a new set resets the tracker', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({ reps: 10 }), 0);
    narrator.update(at({ reps: 0 }), 1000);
    expect(narrator.update(at({ reps: 1 }), 2000)?.text).toBe('uno');
  });
});

describe('createNarrator (hold)', () => {
  it('marks every ten seconds and the last five', () => {
    const narrator = createNarrator(RULES.plank);
    narrator.update(at({ holdMs: 1000 }), 0);
    expect(narrator.update(at({ holdMs: 9000 }), 8000)).toBeNull();
    expect(narrator.update(at({ holdMs: 10_000, tone: 'ok' }), 9000)?.text).toBe('diez segundos');
    expect(narrator.update(at({ holdMs: 20_000, tone: 'ok' }), 19_000)?.text).toBe('veinte segundos');
    expect(narrator.update(at({ holdMs: 25_000, tone: 'ok' }), 24_000)?.text).toBe('¡Cinco segundos más!');
    expect(narrator.update(at({ holdMs: 26_000, tone: 'ok' }), 25_000)).toBeNull();
  });
});

describe('texts', () => {
  const exercise = { name: 'Sentadilla profunda', lines: ['Pies al ancho de caderas.', 'Bajá con el pecho arriba.', 'Subí empujando con talones.', 'Cuarto paso que no se lee.'] };

  it('introduces the exercise, camera setup, sets and the first steps', () => {
    const text = introText(exercise, RULES.squat, 3);
    expect(text).toContain('Sentadilla profunda');
    expect(text).toContain('de costado');
    expect(text).toContain('3 series de 10 repeticiones');
    expect(text).toContain('Pies al ancho de caderas.');
    expect(text).not.toContain('Cuarto paso');
  });

  it('introduces an exercise without rules', () => {
    expect(introText(exercise, null, 3)).toContain('todavía no tiene corrección');
  });

  it('closes sets and the session', () => {
    expect(setDoneText(1, 3)).toBe('Serie 1 lista. Respirá y seguí con la 2.');
    expect(summaryText(RULES.squat, { reps: 24, badReps: 3, holdMs: 0, errors: { 'Mantené el pecho arriba.': 2 } })).toBe('Terminaste. 24 repeticiones bien hechas y 3 para corregir. Lo que más te costó: Mantené el pecho arriba.');
    expect(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs: 62_000, errors: {} })).toBe('Terminaste. 62 segundos en buena postura.');
  });

  it('cleans symbols for the speech engine', () => {
    expect(forSpeech('A 2–3 m, rodilla a 90° (¡ojo!)')).toBe('A 2 a 3 m, rodilla a 90 grados (¡ojo!)');
  });
});
