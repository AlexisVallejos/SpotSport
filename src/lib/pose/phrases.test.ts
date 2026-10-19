import { describe, expect, it } from 'vitest';
import { FRAMING, type TrackerState } from './engine';
import { CENTER, CLOSER, NO_PERSON } from './framing';
import { allSentences, phrasesFor } from './phrases';
import { RULES } from './rules';
import { clipKey, CORRECTIONS, createNarrator, introText, nextSetText, setDoneText, splitSentences, summaryText } from './script';

const known = new Set(allSentences());
const missing = (text: string) => splitSentences(text).map(clipKey).filter((key) => !known.has(key));

const base: TrackerState = { status: 'active', ready: true, reps: 0, badReps: 0, holdMs: 0, progress: 0, message: '', tone: 'info', failing: [], errors: {}, missing: [], side: null, log: [] };

describe('voice pack coverage', () => {
  it('has no duplicates and the basics', () => {
    const list = allSentences();
    expect(new Set(list).size).toBe(list.length);
    expect(list).toEqual(expect.arrayContaining(['uno', 'veinte', '¡Muy bien!', 'diez segundos', 'Dale, ya te veo', 'Dale, arrancamos']));
  });

  it('wrote a spoken version of every correction a rule can give', () => {
    for (const rule of Object.values(RULES)) {
      const messages = [...rule.checks.map((check) => check.message), ...(rule.mode === 'reps' ? [rule.shallow] : [])];
      for (const message of messages) expect(CORRECTIONS[message], `${rule.id}: ${message}`).toBeDefined();
    }
    expect(CORRECTIONS[FRAMING]).toBeDefined();
  });

  it('covers everything the narrator can say, rule by rule', () => {
    for (const rule of Object.values(RULES)) {
      const narrator = createNarrator(rule);
      const lines: string[] = [];
      const say = (state: TrackerState, now: number) => {
        const line = narrator.update(state, now);
        if (line) lines.push(line.text);
      };
      let now = 0;
      const tick = () => (now += 20_000);
      for (const message of [FRAMING, NO_PERSON, CENTER, CLOSER]) say({ ...base, status: 'framing', tone: 'warn', message }, tick());
      say(base, tick());
      const messages = [...rule.checks.map((check) => check.message), ...(rule.mode === 'reps' ? [rule.shallow] : [])];
      for (let pass = 0; pass < 3; pass += 1) {
        for (const message of messages) say({ ...base, tone: 'warn', message }, tick());
      }
      let bad = 0;
      for (let reps = 1; reps <= 40; reps += 1) {
        say({ ...base, reps, tone: 'ok' }, tick());
        for (const message of messages) say({ ...base, reps, badReps: (bad += 1), tone: 'warn', message }, tick());
      }
      for (let seconds = 1; seconds <= 95; seconds += 1) say({ ...base, holdMs: seconds * 1000, tone: 'ok' }, tick());

      expect(lines.length).toBeGreaterThan(5);
      for (const line of lines) expect(missing(line), `${rule.id}: "${line}"`).toEqual([]);
    }
  });

  it('only warms up clips that exist in the pack', () => {
    for (const rule of [...Object.values(RULES), null]) expect(phrasesFor(rule).flatMap(missing), rule?.id ?? 'no rule').toEqual([]);
    expect(phrasesFor(RULES.squat, 5).flatMap(missing)).toEqual([]);
  });

  it('covers the setup screens, set endings and summaries', () => {
    for (const rule of Object.values(RULES)) expect(missing(introText(rule)), rule.id).toEqual([]);
    expect(missing(introText(null))).toEqual([]);
    // Every session the person can set up: 1 to 5 sets.
    for (let sets = 1; sets <= 5; sets += 1) {
      for (let set = 1; set <= sets; set += 1) {
        expect(missing(setDoneText(set, sets))).toEqual([]);
        expect(missing(nextSetText(set))).toEqual([]);
      }
    }

    const worst = Object.keys(CORRECTIONS)[1];
    for (const reps of [0, 1, 2, 17, 21, 36, 40, 55, 80, 99]) {
      expect(missing(summaryText(RULES.squat, { reps, badReps: reps % 7, holdMs: 0, errors: { [worst]: 2 } })), `reps ${reps}`).toEqual([]);
    }
    for (const holdMs of [0, 2000, 29_000, 47_000, 62_000, 90_500, 97_000, 98_000, 200_000, 450_000]) {
      expect(missing(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs, errors: {} })), `hold ${holdMs}`).toEqual([]);
    }
    expect(missing(summaryText(null, { reps: 0, badReps: 0, holdMs: 0, errors: {} }))).toEqual([]);
  });
});
