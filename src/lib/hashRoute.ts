import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

const read = () => window.location.hash.replace(/^#\/?/, '');

/** The current `#route` without the hash. Anchors of the landing (#deportes…) also show up here. */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, read, () => '');
}
