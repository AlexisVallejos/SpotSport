import { useSyncExternalStore } from 'react';

// Tema de la web: "system" sigue al sistema operativo; "light" y "dark" lo fijan.
// index.html aplica lo guardado antes de dibujar; esto lo cambia y lo mantiene al día.

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'spot:tema';
const EVENT = 'spot:tema';
const COLORS: Record<Theme, string> = { dark: '#080808', light: '#fbfaf7' };

const media = () => window.matchMedia('(prefers-color-scheme: light)');

export function readPref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export const resolve = (pref: ThemePref): Theme => (pref === 'system' ? (media().matches ? 'light' : 'dark') : pref);

function apply(pref: ThemePref) {
  const root = document.documentElement;
  const theme = resolve(pref);
  root.dataset.theme = theme;
  root.dataset.themePref = pref;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
  window.dispatchEvent(new Event(EVENT));
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };

/**
 * Cambia el tema. Con View Transitions, el nuevo se abre en un círculo que nace del botón
 * (como una luz que se prende); sin soporte o con "menos movimiento", los colores cruzan suave.
 */
export function setThemePref(pref: ThemePref, origin?: { x: number; y: number }) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Sin storage: el cambio dura hasta recargar.
  }
  const before = document.documentElement.dataset.theme;
  const after = resolve(pref);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as ViewTransitionDocument;

  if (before === after) return apply(pref);
  if (doc.startViewTransition && !reduce && origin) {
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    const transition = doc.startViewTransition(() => apply(pref));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 520, easing: 'cubic-bezier(0.22, 0.68, 0, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => undefined);
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-fading');
  apply(pref);
  window.setTimeout(() => root.classList.remove('theme-fading'), 400);
}

/** Si el usuario eligió "Auto", seguimos al sistema cuando cambia (por ejemplo, al anochecer). */
export function watchSystemTheme() {
  const list = media();
  const onChange = () => {
    if (readPref() === 'system') apply('system');
  };
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => 'system');
}
