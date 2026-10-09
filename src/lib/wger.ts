// Ejercicios de wger (https://wger.de): la misma base abierta que usa Ritmo-Vida, en español.
const API = 'https://wger.de/api/v2';
const SPANISH = 4;
const CACHE_KEY = 'spot:wger:v1';

export type Exercise = {
  id: number;
  name: string;
  category: number;
  muscles: string[];
  equipment: string[];
  image: string | null;
  lines: string[];
  tip?: string;
  easier?: string;
  source: 'ritmo' | 'wger';
};

export const CATEGORY: Record<number, string> = { 8: 'Brazos', 9: 'Piernas', 10: 'Abdomen', 11: 'Pecho', 12: 'Espalda', 13: 'Hombros', 14: 'Pantorrillas', 15: 'Cardio' };

const EQUIPMENT: Record<number, string> = {
  1: 'Barra',
  2: 'Barra Z',
  3: 'Mancuernas',
  4: 'Colchoneta',
  5: 'Pelota suiza',
  6: 'Barra de dominadas',
  7: 'Sin equipo',
  8: 'Banco',
  9: 'Banco inclinado',
  10: 'Pesa rusa',
  11: 'Banda elástica',
  12: 'Polea',
};

const MUSCLE: Record<string, string> = {
  Shoulders: 'Hombros',
  Biceps: 'Bíceps',
  Chest: 'Pecho',
  Triceps: 'Tríceps',
  Abs: 'Abdomen',
  Quads: 'Cuádriceps',
  Glutes: 'Glúteos',
  Calves: 'Pantorrillas',
  Hamstrings: 'Isquiotibiales',
  Lats: 'Dorsales',
  Traps: 'Trapecios',
  Obliques: 'Oblicuos',
  Brachialis: 'Braquial',
  'Lower back': 'Zona lumbar',
};

type Raw = Record<string, any>;

function plain(html: string): string[] {
  return html
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1);
}

/** One wger entry, slimmed down to what the page shows. Null when it has no Spanish translation. */
export function slim(entry: Raw): Exercise | null {
  const translation = (entry.translations ?? []).find((item: Raw) => item.language === SPANISH && String(item.name ?? '').trim());
  if (!translation) return null;
  const main = (entry.images ?? []).find((image: Raw) => image.is_main) ?? entry.images?.[0];
  const muscles = [...(entry.muscles ?? []), ...(entry.muscles_secondary ?? [])].map((muscle: Raw) => MUSCLE[muscle.name_en] ?? muscle.name_en).filter(Boolean);
  return {
    id: entry.id,
    name: String(translation.name).trim(),
    category: entry.category?.id ?? 0,
    muscles: [...new Set<string>(muscles)].slice(0, 4),
    equipment: (entry.equipment ?? []).map((item: Raw) => EQUIPMENT[item.id]).filter(Boolean),
    image: main?.thumbnails?.medium ?? main?.image ?? null,
    lines: plain(String(translation.description ?? '')).slice(0, 14),
    source: 'wger',
  };
}

async function page(offset: number): Promise<Raw> {
  const response = await fetch(`${API}/exerciseinfo/?language=${SPANISH}&limit=100&offset=${offset}&format=json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`wger respondió ${response.status}.`);
  return await response.json();
}

function cached(): Exercise[] | null {
  try {
    const text = sessionStorage.getItem(CACHE_KEY);
    return text ? (JSON.parse(text) as Exercise[]) : null;
  } catch {
    return null;
  }
}

/** Every exercise wger has in Spanish. Fetched once per browser session. */
export async function loadCatalog(): Promise<Exercise[]> {
  const hit = cached();
  if (hit) return hit;
  const first = await page(0);
  const total = Number(first.count ?? 0);
  const offsets: number[] = [];
  for (let offset = 100; offset < total; offset += 100) offsets.push(offset);
  const rest = await Promise.all(offsets.map((offset) => page(offset).catch(() => ({ results: [] }))));
  const seen = new Set<number>();
  const exercises: Exercise[] = [];
  for (const entry of [first, ...rest].flatMap((chunk) => chunk.results ?? [])) {
    const item = slim(entry);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      exercises.push(item);
    }
  }
  if (exercises.length < 20) throw new Error('wger devolvió muy pocos ejercicios.');
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(exercises));
  } catch {
    // Sin storage (modo privado): se vuelve a pedir la próxima vez.
  }
  return exercises;
}

export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Category and muscles for a subtitle, without repeats ("Abdomen · Abdomen"). */
export function subtitle(exercise: Exercise, extra: string[] = [], limit = Infinity): string {
  return [...new Set([CATEGORY[exercise.category], ...exercise.muscles, ...extra].filter(Boolean))].slice(0, limit).join(' · ');
}

/** Exercises matching every typed word (name, muscles or category), optionally inside one category. Ritmo-Vida first. */
export function searchExercises(list: Exercise[], query: string, category: number | null): Exercise[] {
  const words = fold(query).split(/\s+/).filter((word) => word.length >= 3);
  return list
    .filter((exercise) => category === null || exercise.category === category)
    .map((exercise) => {
      const haystack = fold(`${exercise.name} ${exercise.muscles.join(' ')} ${CATEGORY[exercise.category] ?? ''}`);
      return { exercise, score: words.filter((word) => haystack.includes(word)).length };
    })
    .filter((item) => words.length === 0 || item.score === words.length)
    .sort((a, b) => b.score - a.score || Number(b.exercise.source === 'ritmo') - Number(a.exercise.source === 'ritmo') || Number(!!b.exercise.image) - Number(!!a.exercise.image))
    .map((item) => item.exercise);
}
