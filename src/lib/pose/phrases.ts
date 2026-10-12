import { LOCAL_EXERCISES } from '../exercises/local';
import { ruleFor } from '../exercises/match';
import { FRAMING } from './engine';
import { RULES, type PoseRule } from './rules';
import { CHEERS, clipKey, CORRECTIONS, HOLD_CHEERS, introText, LAST_FIVE, LAST_REP, numberWords, SEEN_HOLD, SEEN_REPS, SETS, setDoneText, splitSentences, summaryText, SUMMARY_MAX } from './script';

/** What a session of this rule is likely to say, to load those clips while the person gets in position. */
export function phrasesFor(rule: PoseRule | null): string[] {
  const texts: string[] = [SEEN_REPS, SEEN_HOLD, LAST_FIVE, ...CHEERS, ...LAST_REP, ...HOLD_CHEERS];
  for (let n = 1; n <= (rule?.mode === 'reps' ? rule.target : 12); n += 1) texts.push(numberWords(n));
  texts.push(...(CORRECTIONS[FRAMING] ?? []));
  if (rule) {
    const messages = [...rule.checks.map((check) => check.message), ...(rule.mode === 'reps' ? [rule.shallow] : [])];
    for (const message of messages) texts.push(...(CORRECTIONS[message] ?? []));
    if (rule.mode === 'hold') for (let s = 10; s <= rule.target; s += 10) texts.push(`${numberWords(s)} segundos.`);
  }
  for (let set = 1; set <= SETS; set += 1) texts.push(setDoneText(set, SETS));
  return texts;
}

/**
 * Every sentence the coach can say, as pack keys (`clipKey`). The voice pack is recorded from this list,
 * and a test checks that anything the narrator says is in it, so the voice never falls back to a robot.
 */
export function allSentences(): string[] {
  const keys = new Set<string>();
  const add = (text: string) => splitSentences(text).forEach((sentence) => keys.add(clipKey(sentence)));

  for (let n = 1; n <= SUMMARY_MAX; n += 1) add(numberWords(n));
  for (let s = 10; s <= 90; s += 10) add(`${numberWords(s)} segundos.`);
  [...CHEERS, ...LAST_REP, ...HOLD_CHEERS, SEEN_REPS, SEEN_HOLD, LAST_FIVE].forEach(add);
  Object.values(CORRECTIONS).flat().forEach(add);

  // Setup screens: every rule on its own, and the local routines with their written steps.
  for (const rule of Object.values(RULES)) add(introText(rule, [], SETS));
  for (const exercise of LOCAL_EXERCISES) add(introText(ruleFor(exercise.name), exercise.lines, SETS));
  add(introText(null, [], SETS));

  for (let sets = 2; sets <= 6; sets += 1) for (let set = 1; set <= sets; set += 1) add(setDoneText(set, sets));

  // Closing summary, in pieces (a count, a fix count, an encouragement) so they combine freely.
  const squat = RULES.squat;
  const plank = RULES.plank;
  for (let n = 0; n <= SUMMARY_MAX; n += 1) {
    add(summaryText(squat, { reps: n, badReps: 0, holdMs: 0, errors: {} }));
    add(summaryText(squat, { reps: 0, badReps: n, holdMs: 0, errors: {} }));
  }
  for (let seconds = 0; seconds <= 95; seconds += 5) add(summaryText(plank, { reps: 0, badReps: 0, holdMs: seconds * 1000, errors: {} }));
  add(summaryText(null, { reps: 0, badReps: 0, holdMs: 0, errors: {} }));
  add('Lo que más te costó fue esto.');

  return [...keys].sort();
}
