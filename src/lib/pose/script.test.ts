import { describe, expect, it } from 'vitest';
import { FRAMING, type TrackerState } from './engine';
import { RULES } from './rules';
import { CHEERS, clipKey, CORRECTIONS, createNarrator, forSpeech, introText, nextSetText, numberWords, SEEN, setDoneText, splitSentences, summaryText } from './script';

const base: TrackerState = { status: 'active', ready: true, reps: 0, badReps: 0, holdMs: 0, progress: 0, message: '', tone: 'info', failing: [], errors: {} };
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

describe('createNarrator (reps): few words, spaced out', () => {
  it('asks to step back once in a while, not on every frame', () => {
    const narrator = createNarrator(RULES.squat);
    const framing = at({ status: 'framing', tone: 'warn', message: FRAMING });
    const first = narrator.update(framing, 0);
    expect(first?.urgent).toBe(false);
    expect(CORRECTIONS[FRAMING]).toContain(first?.text);
    expect(narrator.update(framing, 1000)).toBeNull();
    expect(narrator.update(framing, 20_000)?.urgent).toBe(false);
  });

  it('stays quiet before the person shows up', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({ status: 'framing', tone: 'info', message: 'Empezá cuando quieras.' }), 0)).toBeNull();
  });

  it('says it sees you once, briefly', () => {
    const narrator = createNarrator(RULES.squat);
    expect(narrator.update(at({}), 0)).toEqual({ text: SEEN, urgent: false });
    expect(narrator.update(at({}), 33)).toBeNull();
  });

  it('does not read out every repetition: the count is on screen', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    let spoken = 0;
    for (const reps of [1, 2, 3, 4]) if (narrator.update(at({ reps, tone: 'ok' }), reps * 6000)) spoken += 1;
    expect(spoken).toBe(0);
  });

  it('gives a short check-in every five and warns before the last one', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    expect(narrator.update(at({ reps: 5 }), 10_000)?.text).toBe('cinco');
    narrator.update(at({ reps: 8 }), 20_000);
    expect(narrator.update(at({ reps: 9 }), 30_000)?.text).toMatch(/Una más/);
  });

  it('cheers a little on the tens', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const line = narrator.update(at({ reps: 10 }), 10_000)?.text ?? '';
    expect(line.startsWith('diez. ')).toBe(true);
    expect(CHEERS).toContain(line.slice('diez. '.length));
  });

  it('corrects a bad rep in short Argentine Spanish, and not twice in a row', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    const bad = at({ badReps: 1, tone: 'warn', message: SHALLOW });
    const first = narrator.update(bad, 10_000);
    expect(first?.urgent).toBe(false);
    expect(CORRECTIONS[SHALLOW]).toContain(first?.text);
    expect(first?.text.split(' ').length).toBeLessThanOrEqual(5);
    expect(narrator.update({ ...bad, badReps: 2 }, 12_000)).toBeNull();
    const again = narrator.update({ ...bad, badReps: 3 }, 30_000);
    expect(again?.text).not.toBe(first?.text);
  });

  it('never talks over itself: lines come at least a few seconds apart', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    expect(narrator.update(at({ badReps: 1, tone: 'warn', message: SHALLOW }), 10_000)).not.toBeNull();
    expect(narrator.update(at({ reps: 5 }), 11_000)).toBeNull();
  });

  it('does not nag while you are mid-rep: corrections come after it', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    expect(narrator.update(at({ tone: 'warn', message: CHEST }), 10_000)).toBeNull();
  });

  it('speaks a message with no special wording as it is', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    expect(narrator.update(at({ badReps: 1, tone: 'warn', message: 'Algo nuevo.' }), 10_000)?.text).toBe('Algo nuevo.');
  });

  it('keeps counting after a new set resets the tracker', () => {
    const narrator = createNarrator(RULES.squat);
    narrator.update(at({}), 0);
    narrator.update(at({ reps: 10 }), 10_000);
    narrator.update(at({ reps: 0 }), 20_000);
    expect(narrator.update(at({ reps: 5 }), 30_000)?.text).toBe('cinco');
  });
});

describe('createNarrator (hold)', () => {
  it('marks only the tens, with no extra chatter', () => {
    const narrator = createNarrator(RULES.plank);
    expect(narrator.update(at({ holdMs: 1000 }), 0)?.text).toBe(SEEN);
    expect(narrator.update(at({ holdMs: 9000, tone: 'ok' }), 8000)).toBeNull();
    expect(narrator.update(at({ holdMs: 10_000, tone: 'ok' }), 10_000)?.text).toBe('diez segundos.');
    expect(narrator.update(at({ holdMs: 17_000, tone: 'ok' }), 17_000)).toBeNull();
    expect(narrator.update(at({ holdMs: 20_000, tone: 'ok' }), 20_000)?.text).toBe('veinte segundos.');
    expect(narrator.update(at({ holdMs: 25_000, tone: 'ok' }), 25_000)).toBeNull();
  });

  it('warns when the form slips, not more than every few seconds', () => {
    const narrator = createNarrator(RULES.plank);
    narrator.update(at({}), 0);
    const slipping = at({ tone: 'warn', message: 'Subí la cadera.' });
    const first = narrator.update(slipping, 10_000);
    expect(CORRECTIONS['Subí la cadera.']).toContain(first?.text);
    expect(narrator.update(slipping, 12_000)).toBeNull();
    expect(narrator.update(slipping, 14_000)).toBeNull();
  });
});

describe('texts', () => {
  it('introduces the exercise in two short sentences', () => {
    expect(splitSentences(introText(RULES.squat))).toEqual(['Vamos con sentadilla.', 'Ponete de costado a la cámara.']);
    expect(splitSentences(introText(RULES.sidePlank))).toEqual(['Vamos con plancha lateral.', 'Ponete de frente a la cámara.']);
  });

  it('keeps the explanation under fifteen words', () => {
    for (const rule of Object.values(RULES)) expect(introText(rule).split(/s+/).length, rule.id).toBeLessThanOrEqual(15);
  });

  it('introduces an exercise without rules, without naming it', () => {
    expect(splitSentences(introText(null))).toEqual(['Vamos.', 'Ubicate para que se te vea entero.']);
  });

  it('closes sets briefly and names the next one after the rest', () => {
    expect(setDoneText(1, 3)).toBe('Muy bien, serie uno lista. Descansá.');
    expect(setDoneText(3, 3)).toBe('Muy bien, serie tres lista.');
    expect(nextSetText(2)).toBe('Dale, arrancamos. Serie dos.');
  });

  it('summarizes reps with numbers in words, only mentioning what matters', () => {
    expect(summaryText(RULES.squat, { reps: 24, badReps: 3, holdMs: 0, errors: { [CHEST]: 2 } })).toBe(`Listo, terminaste. Veinticuatro repeticiones bien hechas. Tres para corregir. ${CORRECTIONS[CHEST][0]}`);
    expect(summaryText(RULES.squat, { reps: 1, badReps: 0, holdMs: 0, errors: {} })).toBe('Listo, terminaste. Una repetición bien hecha.');
    expect(summaryText(RULES.squat, { reps: 0, badReps: 21, holdMs: 0, errors: {} })).toBe('Listo, terminaste. Ninguna repetición bien hecha. Veintiuna para corregir.');
  });

  it('summarizes a hold in rounded seconds', () => {
    expect(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs: 62_000, errors: {} })).toBe('Listo, terminaste. Aguantaste unos sesenta segundos.');
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

  it('keeps every spoken correction short', () => {
    for (const variants of Object.values(CORRECTIONS)) for (const text of variants) expect(text.split(/\s+/).length, text).toBeLessThanOrEqual(6);
  });
});
