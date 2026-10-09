import { describe, expect, it } from 'vitest';
import { searchExercises, slim, subtitle, type Exercise } from './wger';

describe('subtitle', () => {
  it('skips repeats and cuts at the limit', () => {
    const exercise: Exercise = { id: 1, name: 'Plancha', category: 10, muscles: ['Abdomen', 'Oblicuos', 'Hombros'], equipment: [], image: null, lines: [], source: 'wger' };
    expect(subtitle(exercise)).toBe('Abdomen · Oblicuos · Hombros');
    expect(subtitle(exercise, ['Colchoneta'], 2)).toBe('Abdomen · Oblicuos');
  });
});

describe('slim', () => {
  it('keeps the Spanish translation as plain text', () => {
    const exercise = slim({
      id: 7,
      category: { id: 9 },
      muscles: [{ name_en: 'Quads' }],
      muscles_secondary: [{ name_en: 'Glutes' }],
      equipment: [{ id: 7 }],
      images: [{ is_main: true, image: 'https://wger.de/a.png' }],
      translations: [
        { language: 2, name: 'Squat', description: '<p>English</p>' },
        { language: 4, name: ' Sentadilla ', description: '<p>Bajá&nbsp;lento.</p><p>Subí.</p>' },
      ],
    });
    expect(exercise).toEqual({
      id: 7,
      name: 'Sentadilla',
      category: 9,
      muscles: ['Cuádriceps', 'Glúteos'],
      equipment: ['Sin equipo'],
      image: 'https://wger.de/a.png',
      lines: ['Bajá lento.', 'Subí.'],
      source: 'wger',
    });
  });

  it('drops exercises without Spanish', () => {
    expect(slim({ id: 1, translations: [{ language: 2, name: 'Squat' }] })).toBeNull();
  });
});

describe('searchExercises', () => {
  const make = (id: number, name: string, category: number, image: string | null = null): Exercise => ({ id, name, category, muscles: [], equipment: [], image, lines: [], source: 'wger' });
  const list = [make(1, 'Press de banca', 11), make(2, 'Sentadilla búlgara', 9), make(3, 'Sentadilla', 9, 'x.png'), make(4, 'Plancha', 10)];

  it('matches words ignoring accents and case', () => {
    expect(searchExercises(list, 'SENTADÍLLA', null).map((item) => item.id)).toEqual([3, 2]);
  });
  it('matches the category name', () => {
    expect(searchExercises(list, 'piernas', null).map((item) => item.id)).toEqual([3, 2]);
  });
  it('filters by category', () => {
    expect(searchExercises(list, '', 10).map((item) => item.id)).toEqual([4]);
  });
  it('returns everything for an empty query, images first', () => {
    expect(searchExercises(list, '', null).map((item) => item.id)).toEqual([3, 1, 2, 4]);
  });
  it('puts the Ritmo-Vida routines before wger', () => {
    const own: Exercise = { ...make(-1, 'Sentadilla profunda', 9), source: 'ritmo' };
    expect(searchExercises([...list, own], 'sentadilla', null).map((item) => item.id)).toEqual([-1, 3, 2]);
  });
});
