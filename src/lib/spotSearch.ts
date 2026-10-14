// Abre la búsqueda Spotlight desde cualquier lugar (botón del menú, atajos) sin pasar props.
const OPEN_EVENT = 'spot:buscar';
const RECENT_KEY = 'spot:busquedas-recientes';
const MAX_RECENT = 5;

export type OpenSearchDetail = { text?: string; origin?: DOMRect | null };

export function openSpotSearch(detail: OpenSearchDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenSearchDetail>(OPEN_EVENT, { detail }));
}

export function onOpenSpotSearch(handler: (detail: OpenSearchDetail) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<OpenSearchDetail>).detail ?? {});
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export function recentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(text: string) {
  const clean = text.trim();
  if (clean.length < 2) return;
  const next = [clean, ...recentSearches().filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Sin storage: no se recuerdan búsquedas.
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nada que borrar.
  }
}

/** ⌘K en Mac, Ctrl K en el resto: lo mostramos como pista en el botón. */
export const shortcutLabel = () => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K');
