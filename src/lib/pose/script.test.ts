import { describe, expect, it } from 'vitest';
import { FRAMING, type TrackerState } from './engine';
import { RULES } from './rules';
import { CHEERS, clipKey, CORRECTIONS, createNarrator, forSpeech, introText, numberWords, setDoneText, splitSentences, summaryText } from './script';

const base: TrackerState = { status: 'active', reps: 0, badReps: 0, holdMs: 0, progress: 0, message: '', tone: 'info', failing: [], errors: {} };
const at = (patch: Partial<TrackerState>): TrackerState => ({ ...base, ...patch });

const SHALLOW = 'Bajá más: muslos paralelos al piso.';
const CHEST = 'Mantené el pecho arriba.';

describe('numberWords', () => {
  it('spells 0–99 in Spanish', () => {
    expect([0, 1, 9, 15, 16, 20, 21, 22, 29, 30, 31, 45, 60, 99].map((n) => numberWords(n))).toEqual(['cero', 'uno', 'nueve', 'quince', 'dieciséis', 'veinte', 'veintiuno', 'veintidós', 'veintinueve', 'treinta', 'treinta y uno', 'cuarenta y cinco', 'sesenta', 'noventa y nueve']);
  });
  it('uses the feminine for things like "repeticiones"', () => {
    expect(numberWords(1, true)).toBe('una');
    expect(numberWords(21, true)).toBe('veintiuna');
    expect(numberWords(31, true)).toBe('treinta y una');
    expect(numberWords(2, true)).toBe('dos');
  });
  it('falls back to digits outside the range', () => {
    expect(numberWords(100)).toBe('100');
  });
});

describe('createNarrator (reps)', () => {
  it('asks to step back once in a while, not on every frame', () => {
    const narrator = createNarrator(RULES.squat);
    const framing = at({ status: 'framing', tone: 'warn', message: FRAMING });
    const first = narrator.update(framing, 0);
    expect(first?.urgent).toBe(false);
    expect(CORRECTIONS[FRAMING]).toContain(first?.text);
    expect(narrator.update(framing, 1000)).toBeNull();
    expect(narrator.update(framing, 11_000)?.urgent).toBe(false);
  });

  it('stays quiet before the person shows up', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({ status: 'framing', tone: 'info', message: 'Empezá cuando quieras.' }), 0)).toBeNull();
  });

  it('says it sees you once, then counts', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({}), 0)?.text).toBe('Dale, ya te veo. Cuando quieras, arrancá.');
    expect(narrator.update(at({}), 33)).toBeNull();
    expect(narrator.update(at({ reps: 1, tone: 'ok', message: '¡Bien! Van 1.' }), 2000)).toEqual({ text: 'uno', urgent: false });
    expect(narrator.update(at({ reps: 2, tone: 'ok' }), 4000)?.text).toBe('dos');
  });

  it('cheers on multiples of five, with different words each time', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({ reps: 4 }), 0);
    const five = narrator.update(at({ reps: 5 }), 1000)?.text ?? '';
    expect(five.startsWith('cinco. ')).toBe(true);
    expect(CHEERS).toContain(five.slice('cinco. '.length));
    const ten = narrator.update(at({ reps: 10 }), 2000)?.text ?? '';
    expect(ten.startsWith('diez. ')).toBe(true);
    expect(ten).not.toBe(`diez. ${five.slice('cinco. '.length)}`);
  });

  it('warns before the last rep', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({ reps: 8 }), 0);
    expect(narrator.update(at({ reps: 9 }), 1000)?.text).toMatch(/^nueve\. ¡Una más/);
  });

  it('corrects a bad rep in Argentine Spanish, urgently, and not twice in a row', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const bad = at({ badReps: 1, tone: 'warn', message: SHALLOW });
    const first = narrator.update(bad, 3000);
    expect(first?.urgent).toBe(true);
    expect(CORRECTIONS[SHALLOW]).toContain(first?.text);
    expect(narrator.update({ ...bad, badReps: 2 }, 5000)).toBeNull();
    const again = narrator.update({ ...bad, badReps: 3 }, 10_000);
    expect(again?.urgent).toBe(true);
    expect(again?.text).not.toBe(first?.text);
  });

  it('speaks a message with no special wording as it is', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    expect(narrator.update(at({ tone: 'warn', message: 'Algo nuevo.' }), 1000)).toEqual({ text: 'Algo nuevo.', urgent: true });
  });

  it('warns live while the form is wrong', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const live = at({ tone: 'warn', message: CHEST });
    const line = narrator.update(live, 1000);
    expect(line?.urgent).toBe(true);
    expect(CORRECTIONS[CHEST]).toContain(line?.text);
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
    expect(narrator.update(at({ holdMs: 1000 }), 0)?.text).toBe('Dale, ya te veo. Ponete en posición y aguantá.');
    expect(narrator.update(at({ holdMs: 9000 }), 8000)).toBeNull();
    expect(narrator.update(at({ holdMs: 10_000, tone: 'ok' }), 9000)?.text).toMatch(/^diez segundos\./);
    expect(narrator.update(at({ holdMs: 20_000, tone: 'ok' }), 19_000)?.text).toMatch(/^veinte segundos\./);
    expect(narrator.update(at({ holdMs: 25_000, tone: 'ok' }), 24_000)?.text).toBe('¡Cinco segundos más, aguantá!');
    expect(narrator.update(at({ holdMs: 26_000, tone: 'ok' }), 25_000)).toBeNull();
  });
});

describe('texts', () => {
  const steps = ['Pies al ancho de caderas.', 'Bajá con el pecho arriba.', 'Subí empujando con talones.', 'Cuarto paso que no se lee.'];

  it('introduces the exercise like a teacher: camera, sets and the first steps', () => {
    const text = introText(RULES.squat, steps, 3);
    expect(text).toContain('Dale, vamos con sentadilla.');
    expect(text).toContain('de costado');
    expect(text).toContain('a 2 o 3 metros');
    expect(text).toContain('Hacemos tres series de diez repeticiones.');
    expect(text).toContain('Pies al ancho de caderas.');
    expect(text).not.toContain('Cuarto paso');
    expect(text).toContain('activá la cámara y arrancamos');
  });

  it('introduces an exercise without rules, without naming it', () => {
    const text = introText(null, [], 3);
    expect(text).toContain('todavía no tiene corrección');
    expect(text.startsWith('Dale, vamos.')).toBe(true);
  });

  it('closes sets', () => {
    expect(setDoneText(1, 3)).toBe('Muy bien, serie uno lista. Respirá un poquito y vamos con la segunda.');
    expect(setDoneText(3, 3)).toBe('Muy bien, serie tres lista.');
  });

  it('summarizes reps with numbers in words', () => {
    expect(summaryText(RULES.squat, { reps: 24, badReps: 3, holdMs: 0, errors: { [CHEST]: 2 } })).toBe(`Listo, terminaste. Veinticuatro repeticiones bien hechas. Tres para corregir. Lo que más te costó fue esto. ${CORRECTIONS[CHEST][0]}`);
    expect(summaryText(RULES.squat, { reps: 1, badReps: 0, holdMs: 0, errors: {} })).toBe('Listo, terminaste. Una repetición bien hecha. Ninguna para corregir.');
    expect(summaryText(RULES.squat, { reps: 0, badReps: 21, holdMs: 0, errors: {} })).toBe('Listo, terminaste. Ninguna repetición bien hecha. Veintiuna para corregir.');
  });

  it('summarizes a hold in rounded seconds', () => {
    expect(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs: 62_000, errors: {} })).toBe('Listo, terminaste. Aguantaste unos sesenta segundos en buena postura.');
    expect(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs: 1000, errors: {} })).toBe('Listo, terminaste. Casi no aguantaste, probemos de nuevo.');
  });

  it('cleans symbols for the speech engine', () => {
    expect(forSpeech('A 2–3 m, rodilla a 90° (¡ojo!)')).toBe('A 2 o 3 m, rodilla a 90 grados (¡ojo!)');
    expect(forSpeech('Hombros — arriba')).toBe('Hombros, arriba');
  });

  it('splits lines into sentences and keys them without the final full stop', () => {
    expect(splitSentences('cinco. ¡Muy bien!')).toEqual(['cinco.', '¡Muy bien!']);
    expect(splitSentences('Bajá más: muslos paralelos al piso.')).toEqual(['Bajá más: muslos paralelos al piso.']);
    expect(clipKey('cinco.')).toBe('cinco');
    expect(clipKey('¡Muy bien!')).toBe('¡Muy bien!');
    expect(clipKey('uno')).toBe('uno');
  });
});
