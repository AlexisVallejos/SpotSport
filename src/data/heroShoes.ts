// Línea de tiempo del video de portada (public/video/hero-lava-*.mp4, en loop).
// Cada zapatilla se forma en la lava, se queda un rato y se desintegra; entre una y
// otra hay un tramo de lava vacía. Los tiempos de abajo son los del video original
// (15 s); el archivo publicado está ralentizado ×SLOWDOWN con cuadros interpolados.
//
//  0 ──── 1.75 ░ 2.5 ░ 3.4 ──── 6.85 ░ 7.4 ░ 8.3 ──── 11.75 ░ 12.4 ░ 13.3 ──── 15
//    Órbita   se va  vacío  Pulso    se va  vacío  Distrito   se va   vacío  Órbita
export type HeroShoe = {
  key: 'a' | 'b' | 'c';
  index: string;
  discipline: string;
  name: string;
  line: string;
  href: string;
  thumb: string;
  poster: string;
  posterMobile: string;
  /** Desde cuándo la zapatilla está completa en pantalla. */
  shownAt: number;
  /** Cuándo empieza a desintegrarse. */
  leavesAt: number;
  /** Punto de lava vacía después de irse: desde acá se puede saltar a cualquier otra. */
  goneAt: number;
};

/** Cuánto más lento va el video publicado respecto del original. */
export const SLOWDOWN = 1.5;
export const HERO_DURATION = 15 * SLOWDOWN;

const originalTimeline: HeroShoe[] = [
  {
    key: 'a',
    index: '01',
    discipline: 'Running',
    name: 'SPOT Órbita 01',
    line: 'Malla liviana y retorno en cada zancada.',
    href: '#calzado/running',
    thumb: '/images/footwear-orbita-01.webp',
    poster: '/images/hero/lava-a.jpg',
    posterMobile: '/images/hero/lava-a-m.jpg',
    shownAt: 13.3,
    leavesAt: 1.75,
    goneAt: 2.5,
  },
  {
    key: 'b',
    index: '02',
    discipline: 'Entrenamiento',
    name: 'SPOT Pulso TR',
    line: 'Base firme para levantar, saltar y volver a empezar.',
    href: '#calzado/training',
    thumb: '/images/footwear-pulso-tr.webp',
    poster: '/images/hero/lava-b.jpg',
    posterMobile: '/images/hero/lava-b-m.jpg',
    shownAt: 3.4,
    leavesAt: 6.85,
    goneAt: 7.4,
  },
  {
    key: 'c',
    index: '03',
    discipline: 'Sportstyle',
    name: 'SPOT Distrito',
    line: 'Silueta clásica. Actitud de calle.',
    href: '#calzado/sportstyle',
    thumb: '/images/footwear-distrito.webp',
    poster: '/images/hero/lava-c.jpg',
    posterMobile: '/images/hero/lava-c-m.jpg',
    shownAt: 8.3,
    leavesAt: 11.75,
    goneAt: 12.4,
  },
];

export const heroShoes: HeroShoe[] = originalTimeline.map(shoe => ({
  ...shoe,
  shownAt: shoe.shownAt * SLOWDOWN,
  leavesAt: shoe.leavesAt * SLOWDOWN,
  goneAt: shoe.goneAt * SLOWDOWN,
}));

const previous = (i: number) => (i + heroShoes.length - 1) % heroShoes.length;

/** Momento en que la zapatilla `i` empieza a formarse (la lava vacía que la precede). */
export const appearsAt = (i: number) => heroShoes[previous(i)].goneAt;

/** Qué zapatilla "es dueña" del instante t: cambia apenas la anterior empieza a irse. */
export const ownerAt = (t: number) => {
  const i = heroShoes.findIndex(({ leavesAt }) => t < leavesAt);
  return i === -1 ? 0 : i;
};

/** Si la zapatilla `i` está completa en pantalla en el instante t. */
export const isShown = (i: number, t: number) => {
  const { shownAt, leavesAt } = heroShoes[i];
  return shownAt < leavesAt ? t >= shownAt && t < leavesAt : t >= shownAt || t < leavesAt;
};

/** Avance (0–1) de la zapatilla dueña dentro de su ciclo completo, para la barra de progreso. */
export const progressAt = (t: number) => {
  const i = ownerAt(t);
  const start = heroShoes[previous(i)].leavesAt;
  const end = heroShoes[i].leavesAt;
  const span = (end - start + HERO_DURATION) % HERO_DURATION;
  return ((t - start + HERO_DURATION) % HERO_DURATION) / span;
};

export type HeroJump = {
  /** A qué segundo mover el video. */
  seekTo: number;
  /** Si hay que esperar a que la actual se desintegre antes de saltar a la elegida. */
  pending: { from: number; to: number } | null;
};

/**
 * Decide cómo llegar a la zapatilla `target` sin cortes bruscos.
 * - Si la actual está en pantalla, se la deja desintegrar; si la elegida es la
 *   siguiente, el video ya la trae solo; si no, se salta con la lava vacía.
 * - Si ya está en la lava vacía (o formándose otra), se va directo a la elegida.
 */
export const planJump = (t: number, target: number, pendingTo?: number): HeroJump | null => {
  const current = ownerAt(t);
  if (target === (pendingTo ?? current)) return null;
  if (isShown(current, t)) {
    const nextIndex = (current + 1) % heroShoes.length;
    return { seekTo: heroShoes[current].leavesAt, pending: target === nextIndex ? null : { from: current, to: target } };
  }
  return { seekTo: appearsAt(target), pending: null };
};

/** Con un salto pendiente: si ya llegó la lava vacía, devuelve a qué segundo saltar. */
export const resolvePending = (t: number, pending: { from: number; to: number }) => {
  const gone = heroShoes[pending.from].goneAt;
  return t >= gone && t < gone + SLOWDOWN ? appearsAt(pending.to) : null;
};
