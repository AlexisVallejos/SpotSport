import { describe, expect, it } from 'vitest';
import { LOCAL_EXERCISES } from './local';
import { ruleFor } from './match';

describe('ruleFor', () => {
  it.each([
    ['Sentadilla profunda', 'squat'],
    ['Estocadas alternadas', 'lunge'],
    ['Zancadas con mancuernas', 'lunge'],
    ['Flexiones diamante', 'pushup'],
    ['Push-ups', 'pushup'],
    ['Plancha abdominal', 'plank'],
    ['Plancha lateral', 'sidePlank'],
    ['Hip thrust con pelota', 'bridge'],
    ['Puente de glúteo', 'bridge'],
    ['Levantamiento de piernas', 'legRaise'],
    ['Elevación de piernas colgado', 'legRaise'],
    ['Patada de glúteo', 'kick'],
    ['Patadas traseras', 'kick'],
    ['Patada de burro con mancuerna', 'kick'],
    ['Plancha de lado derecho', 'sidePlank'],
  ])('%s → %s', (name, id) => {
    expect(ruleFor(name)?.id).toBe(id);
  });

  it.each([
    'Curl de bíceps',
    'Flexión de bíceps',
    'Flexión de piernas tumbado',
    'Press de banca',
    'Dorsiflexión de tobillo',
    'Burpees sin Flexión',
    'Flexión lateral con mancuerna',
    'Flexión a pino contra la pared',
    'Estiramiento de flexión horizontal del hombro',
  ])('%s has no rule', (name) => {
    expect(ruleFor(name)).toBeNull();
  });

  it('covers every local exercise', () => {
    for (const exercise of LOCAL_EXERCISES) expect(ruleFor(exercise.name), exercise.name).not.toBeNull();
  });
});
