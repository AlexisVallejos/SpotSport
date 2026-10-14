import { useSyncExternalStore } from 'react';

// Favoritos del comparador: ids de producto guardados en este navegador.
const KEY = 'spot:precios:favoritos';
const EVENT = 'spot:favoritos';
const EMPTY: string[] = [];

let cache: { raw: string | null; ids: string[] } = { raw: null, ids: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Sin storage (modo privado): no hay favoritos guardados.
  }
  if (raw === cache.raw) return cache.ids;
  let ids: string[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    ids = EMPTY;
  }
  cache = { raw, ids };
  return ids;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function toggleFavorite(id: string) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Los ids guardados; se actualiza en todas las pestañas. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
