import { RULES, type PoseRule, type RuleId } from '../pose/rules';
import { fold } from '../wger';

/** Order matters: the first pattern that matches wins ("plancha lateral" before "plancha"). */
const PATTERNS: [RegExp, RuleId][] = [
  [/plancha (lateral|de lado)|side plank/, 'sidePlank'],
  [/plancha|plank/, 'plank'],
  [/sentadilla|squat/, 'squat'],
  [/estocada|zancada|lunge/, 'lunge'],
  [/puente|hip thrust|glute bridge/, 'bridge'],
  [/(elevacion|levantamiento)(es)? de piernas|leg raise/, 'legRaise'],
  [/patadas? (de gluteo|traseras?|de burro)|donkey kick/, 'kick'],
  [/\bflexion|push.?up|lagartija/, 'pushup'],
];

/** Flexión also names curls, side bends, stretches and handstands: those are not push-ups. */
const NOT_PUSHUP = /biceps|rodilla|pierna|plantar|cadera|muneca|tronco|isquio|femoral|nordic|curl|lateral|pino|burpee|estiramiento|escapular/;

export function ruleFor(name: string): PoseRule | null {
  const text = fold(name);
  for (const [pattern, id] of PATTERNS) {
    if (!pattern.test(text)) continue;
    if (id === 'pushup' && NOT_PUSHUP.test(text)) return null;
    return RULES[id];
  }
  return null;
}
