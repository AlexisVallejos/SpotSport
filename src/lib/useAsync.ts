import { useCallback, useEffect, useRef, useState } from 'react';

type AsyncState<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

/** Carga datos al montar y cuando cambian las dependencias. Ignora respuestas viejas. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    load().then(
      (data) => {
        if (id === latest.current) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (id === latest.current) setState({ data: null, error: error instanceof Error ? error.message : 'No pudimos cargar los datos.', loading: false });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
