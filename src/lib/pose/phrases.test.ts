import { describe, expect, it } from 'vitest';
import { LOCAL_EXERCISES } from '../exercises/local';
import { ruleFor } from '../exercises/match';
import { FRAMING, type TrackerState } from './engine';
import { allSentences, phrasesFor } from './phrases';
import { RULES } from './rules';
import { clipKey, CORRECTIONS, createNarrator, introText, SETS, setDoneText, splitSentences, summaryText } from './script';

const known = new Set(allSentences());
const missing = (text: string) => splitSentences(text).map(clipKey).filter((key) => !known.has(key));

const base: TrackerState = { status: 'active', reps: 0, badReps: 0, holdMs: 0, progress: 0, message: '', tone: 'info', failing: [], errors: {} };

describe('voice pack coverage', () => {
  it('has no duplicates and the basics', () => {
    const list = allSentences();
    expect(new Set(list).size).toBe(list.length);
    expect(list).toEqual(expect.arrayContaining(['uno', 'veinte', '¡Muy bien!', 'diez segundos', 'Dale, ya te veo']));
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
      say({ ...base, status: 'framing', tone: 'warn', message: FRAMING }, tick());
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

      expect(lines.length).toBeGreaterThan(10);
      for (const line of lines) expect(missing(line), `${rule.id}: "${line}"`).toEqual([]);
    }
  });

  it('only warms up clips that exist in the pack', () => {
    for (const rule of [...Object.values(RULES), null]) expect(phrasesFor(rule).flatMap(missing), rule?.id ?? 'no rule').toEqual([]);
  });

  it('covers the setup screens, set endings and summaries', () => {
    for (const rule of Object.values(RULES)) expect(missing(introText(rule, [], SETS))).toEqual([]);
    for (const exercise of LOCAL_EXERCISES) expect(missing(introText(ruleFor(exercise.name), exercise.lines, SETS)), exercise.name).toEqual([]);
    expect(missing(introText(null, [], SETS))).toEqual([]);
    for (let set = 1; set <= SETS; set += 1) expect(missing(setDoneText(set, SETS))).toEqual([]);

    const worst = Object.keys(CORRECTIONS)[1];
    for (const reps of [0, 1, 2, 17, 21, 36, 40, 80]) {
      expect(missing(summaryText(RULES.squat, { reps, badReps: reps % 7, holdMs: 0, errors: { [worst]: 2 } })), `reps ${reps}`).toEqual([]);
    }
    for (const holdMs of [0, 2000, 29_000, 47_000, 62_000, 90_500, 200_000]) {
      expect(missing(summaryText(RULES.plank, { reps: 0, badReps: 0, holdMs, errors: {} })), `hold ${holdMs}`).toEqual([]);
    }
    expect(missing(summaryText(null, { reps: 0, badReps: 0, holdMs: 0, errors: {} }))).toEqual([]);
  });
});
