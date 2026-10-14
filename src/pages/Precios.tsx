import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import { Icon } from '../components/atoms';
// Directos y no desde los barrels: así esta página no suma peso a la landing.
import PriceCard from '../components/molecules/PriceCard/PriceCard';
import PriceDrawer from '../components/organisms/PriceDrawer/PriceDrawer';
import { useFavorites } from '../lib/favorites';
import {
  CATEGORIES,
  GENDERS,
  SORTS,
  SPORTS,
  STORES,
  fromParams,
  loadStatus,
  searchProducts,
  timeAgo,
  toParams,
  type CatalogStatus,
  type Category,
  type Product,
  type SearchQuery,
  type SearchResult,
  type StoreId,
} from '../lib/precios';
import styles from './Precios.module.css';

const PAGE = 48;

const Precios: FunctionComponent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const favorites = useFavorites();
  const onlyFavorites = params.get('favoritos') === '1';
  const query = useMemo(() => fromParams(params), [params]);

  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState(query.q ?? '');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Comparador de precios — SPOT';
    return () => {
      document.title = previous;
    };
  }, []);

  // Mientras la API está leyendo las tiendas, volvemos a preguntar cada 20 s para ir mostrando lo nuevo.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const load = () =>
      loadStatus()
        .then((value) => {
          if (!alive) return;
          setStatus(value);
          if (value.refreshing) timer = window.setTimeout(load, 20_000);
        })
        .catch((reason: Error) => {
          if (!alive) return;
          setError(reason.message);
          timer = window.setTimeout(load, 20_000);
        });
    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const searchQuery: SearchQuery = useMemo(() => ({ ...query, ids: onlyFavorites ? favorites : null, limit: PAGE }), [query, onlyFavorites, favorites]);
  const searchKey = JSON.stringify(searchQuery);
  const refreshes = status?.refreshing ? status.total : null; // Mientras se llena el catálogo, cada novedad vuelve a buscar.

  useEffect(() => {
    if (onlyFavorites && favorites.length === 0) {
      setResult({ total: 0, items: [], brands: [], types: [] });
      return;
    }
    const controller = new AbortController();
    searchProducts(searchQuery, controller.signal)
      .then((value) => {
        setResult(value);
        setError(null);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, refreshes]);

  // El buscador escribe en la URL un rato después de que dejás de tipear.
  useEffect(() => setDraft(query.q ?? ''), [query.q]);
  useEffect(() => {
    if ((query.q ?? '') === draft) return;
    const timer = window.setTimeout(() => update({ q: draft }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const update = (patch: Partial<SearchQuery>, extra: Record<string, string | null> = {}) => {
    const next = toParams({ ...query, ...patch });
    // "Marca" y "tipo" dependen del resto: si cambia la categoría, se limpian.
    if ('category' in patch) {
      next.delete('tipo');
      next.delete('marca');
    }
    const favoritos = 'favoritos' in extra ? extra.favoritos : params.get('favoritos');
    if (favoritos) next.set('favoritos', favoritos);
    setParams(next, { replace: true });
  };

  const loadMore = () => {
    if (!result) return;
    setLoadingMore(true);
    searchProducts({ ...searchQuery, offset: result.items.length })
      .then((value) => setResult((current) => (current ? { ...current, items: [...current.items, ...value.items] } : value)))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoadingMore(false));
  };

  // Abrir una carta cambia la URL (/precios/<id>): el botón "atrás" del teléfono cierra el panel.
  // Si llegaron con ese link directo, cerrar no puede ir "atrás" (saldría de SPOT): vuelve a /precios.
  const openedHere = useRef(false);
  const open = useCallback(
    (product: Product) => {
      openedHere.current = true;
      navigate({ pathname: `/precios/${encodeURIComponent(product.id)}`, search: location.search });
    },
    [navigate, location.search],
  );
  const close = useCallback(() => {
    if (openedHere.current) navigate(-1);
    else navigate({ pathname: '/precios', search: location.search }, { replace: true });
    openedHere.current = false;
  }, [navigate, location.search]);

  const items = result?.items ?? [];
  const preview = id ? (items.find((product) => product.id === id) ?? null) : null;
  const total = status?.total ?? 0;
  const firstLoad = status && status.total === 0;

  const stats = status
    ? [
        { value: total.toLocaleString('es-AR'), label: 'productos de 3 tiendas' },
        { value: status.compared.toLocaleString('es-AR'), label: 'en más de una tienda' },
        { value: timeAgo(status.updatedAt), label: status.refreshing ? 'actualizando ahora…' : 'última actualización' },
      ]
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link to="/" className={styles.back}>
          <Icon name="arrowLeft" size={18} /> SPOT
        </Link>
        <div className={styles.barLinks}>
          <span className={styles.section}>Comparador de precios</span>
          <button type="button" className={onlyFavorites ? styles.favoritesOn : styles.favorites} aria-pressed={onlyFavorites} onClick={() => update({}, { favoritos: onlyFavorites ? null : '1' })}>
            <Heart size={15} fill={onlyFavorites ? 'currentColor' : 'none'} aria-hidden="true" /> Favoritos {favorites.length ? `(${favorites.length})` : ''}
          </button>
        </div>
      </header>

      <main className={styles.main} id="contenido">
        <section className={styles.head} aria-labelledby="precios-titulo">
          <p className={styles.kicker}>OPEN SPORTS · DEXTER · TRIP STORE</p>
          <h1 id="precios-titulo" className={styles.title}>
            EL MEJOR PRECIO,
            <br />
            SIN DAR VUELTAS.
          </h1>
          <p className={styles.lead}>Zapatillas, botines, ropa y accesorios de tres tiendas argentinas. Encontramos el mismo producto en cada una y te mostramos dónde está más barato. Los precios se actualizan solos varias veces por día.</p>
          {stats.length ? (
            <dl className={styles.stats}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        <div className={styles.controls}>
          <div className={styles.tabs} role="group" aria-label="Categoría">
            <button type="button" className={!query.category ? styles.tabOn : styles.tab} aria-pressed={!query.category} onClick={() => update({ category: null })}>
              Todo
            </button>
            {(Object.keys(CATEGORIES) as Category[]).map((category) => (
              <button key={category} type="button" className={query.category === category ? styles.tabOn : styles.tab} aria-pressed={query.category === category} onClick={() => update({ category })}>
                {CATEGORIES[category]}
                {status?.byCategory[category] ? <small>{status.byCategory[category].toLocaleString('es-AR')}</small> : null}
              </button>
            ))}
          </div>

          <label className={styles.search}>
            <Icon name="search" size={18} />
            <input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Buscá: Samba, remera running, Boca, mochila…" aria-label="Buscar productos" />
          </label>

          <div className={styles.chips} role="group" aria-label="Deporte">
            <button type="button" className={!query.sport ? styles.chipOn : styles.chip} aria-pressed={!query.sport} onClick={() => update({ sport: null })}>
              Todos los deportes
            </button>
            {SPORTS.map((sport) => (
              <button key={sport} type="button" className={query.sport === sport ? styles.chipOn : styles.chip} aria-pressed={query.sport === sport} onClick={() => update({ sport })}>
                {sport}
              </button>
            ))}
          </div>

          <div className={styles.row}>
            <div className={styles.chips} role="group" aria-label="Para quién">
              <button type="button" className={!query.gender ? styles.chipOn : styles.chip} aria-pressed={!query.gender} onClick={() => update({ gender: null })}>
                Todos
              </button>
              {GENDERS.map((gender) => (
                <button key={gender} type="button" className={query.gender === gender ? styles.chipOn : styles.chip} aria-pressed={query.gender === gender} onClick={() => update({ gender })}>
                  {gender}
                </button>
              ))}
            </div>
            <label className={styles.select}>
              <span>Tipo</span>
              <select value={query.type ?? ''} onChange={(event) => update({ type: event.target.value || null })}>
                <option value="">Todos</option>
                {query.type && !result?.types.some((type) => type.value === query.type) ? <option value={query.type}>{query.type}</option> : null}
                {(result?.types ?? []).map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.value} ({type.count})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.select}>
              <span>Marca</span>
              <select value={query.brand ?? ''} onChange={(event) => update({ brand: event.target.value || null })}>
                <option value="">Todas</option>
                {query.brand && !result?.brands.some((brand) => brand.value === query.brand) ? <option value={query.brand}>{query.brand}</option> : null}
                {(result?.brands ?? []).map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.value} ({brand.count})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.select}>
              <span>Tienda</span>
              <select value={query.store ?? ''} onChange={(event) => update({ store: (event.target.value || null) as StoreId | null })}>
                <option value="">Las tres</option>
                {(Object.keys(STORES) as StoreId[]).map((store) => (
                  <option key={store} value={store}>
                    {STORES[store].name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.select}>
              <span>Ordenar</span>
              <select value={query.sort} onChange={(event) => update({ sort: event.target.value as SearchQuery['sort'] })}>
                {SORTS.map((sort) => (
                  <option key={sort.key} value={sort.key}>
                    {sort.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={!!query.compared} onChange={(event) => update({ compared: event.target.checked })} />
            Solo lo que está en más de una tienda
          </label>
        </div>

        {error && !result ? (
          <p className={styles.note} role="alert">
            No pudimos conectar con la API de precios ({error}). Reintentamos en unos segundos.
          </p>
        ) : null}
        {firstLoad ? (
          <div className={styles.loading} role="status">
            <span className={styles.pulse} aria-hidden="true" />
            Estamos recorriendo Open Sports, Dexter y Trip Store. La primera vez tarda unos minutos.
          </div>
        ) : null}
        {!result && !error ? (
          <p className={styles.note} role="status">
            Cargando precios…
          </p>
        ) : null}

        {result && !firstLoad ? (
          <>
            <p className={styles.count} aria-live="polite">
              {result.total.toLocaleString('es-AR')} {result.total === 1 ? 'producto' : 'productos'}
              {onlyFavorites ? ' guardados' : ''}
            </p>
            {result.total === 0 ? <p className={styles.note}>{onlyFavorites ? 'Todavía no guardaste nada. Tocá el corazón de una carta para tenerla acá.' : 'No encontramos nada con esos filtros. Probá con otra búsqueda.'}</p> : null}
            <div className={styles.grid}>
              {items.map((product) => (
                <PriceCard key={product.id} product={product} onOpen={open} />
              ))}
            </div>
            {result.total > items.length ? (
              <button type="button" className={styles.more} onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Cargando…' : `Ver más (${(result.total - items.length).toLocaleString('es-AR')} restantes)`}
              </button>
            ) : null}
          </>
        ) : null}

        {status ? (
          <footer className={styles.sources}>
            {(Object.keys(STORES) as StoreId[]).map((store) => {
              const state = status.stores[store];
              return (
                <span key={store}>
                  <b>{STORES[store].name}</b> {state.count.toLocaleString('es-AR')} productos · {state.error && !state.count ? 'sin datos por ahora' : timeAgo(state.updatedAt)}
                </span>
              );
            })}
            <span>Precios publicados en la web de cada tienda. Cruzamos los productos por su código de fabricante, así que comparamos exactamente el mismo modelo y color.</span>
          </footer>
        ) : null}
      </main>

      <AnimatePresence>{id ? <PriceDrawer key={id} id={id} preview={preview} onClose={close} /> : null}</AnimatePresence>
    </div>
  );
};

export default Precios;
