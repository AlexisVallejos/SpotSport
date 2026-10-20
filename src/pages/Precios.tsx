import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { CornerDownLeft, Heart, QrCode, Search, ShoppingBag, Sparkles, Store, Ticket, X } from 'lucide-react';
// Directos y no desde los barrels: así esta página no suma peso a la landing.
import FilterMenu from '../components/molecules/FilterMenu/FilterMenu';
import GlideTabs from '../components/molecules/GlideTabs/GlideTabs';
import PriceCard from '../components/molecules/PriceCard/PriceCard';
import PriceDrawer from '../components/organisms/PriceDrawer/PriceDrawer';
import SiteHeader from '../components/organisms/SiteHeader/SiteHeader';
import { useFavorites } from '../lib/favorites';
import { parseSearch, removeToken } from '../lib/smartQuery';
import { openSpotSearch, rememberSearch, shortcutLabel } from '../lib/spotSearch';
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
  type Product,
  type SearchQuery,
  type SearchResult,
  type SortKey,
  type StoreId,
} from '../lib/precios';
import styles from './Precios.module.css';

const PAGE = 48;

export type CatalogMode = 'comparador' | 'tienda' | 'ofertas';

type ModeConfig = {
  base: string;
  documentTitle: string;
  kicker: string;
  title: [string, string];
  lead: string;
  /** Filtros que la página impone y no se pueden sacar. */
  fixed: Partial<SearchQuery>;
  /** Orden cuando la URL no pide otro. */
  defaultSort: SortKey;
};

// El mismo catálogo en tres vitrinas: el comparador entero, la tienda de zapatillas y las zapatillas rebajadas.
const MODES: Record<CatalogMode, ModeConfig> = {
  comparador: {
    base: '/precios',
    documentTitle: 'Comparador de precios — SPOT',
    kicker: 'OPEN SPORTS · DEXTER · TRIP STORE',
    title: ['EL MEJOR PRECIO,', 'SIN DAR VUELTAS.'],
    lead: 'Zapatillas, botines, ropa y accesorios de tres tiendas argentinas. Encontramos el mismo producto en cada una y te mostramos dónde está más barato. Los precios se actualizan solos varias veces por día.',
    fixed: {},
    defaultSort: 'recomendado',
  },
  tienda: {
    base: '/tienda',
    documentTitle: 'Tienda de zapatillas — SPOT',
    kicker: 'TIENDA SPOT · ZAPATILLAS',
    title: ['COMPRALAS ACÁ,', 'RETIRALAS EN EL LOCAL.'],
    lead: 'Todas las zapatillas de Open Sports, Dexter y Trip Store con el precio de cada tienda. Pagás con Mercado Pago en SPOT y te llevás un ticket con QR para retirarlas en la sucursal que elijas.',
    fixed: { category: 'calzado', type: 'Zapatillas' },
    defaultSort: 'recomendado',
  },
  ofertas: {
    base: '/ofertas',
    documentTitle: 'Ofertas en zapatillas — SPOT',
    kicker: 'OFERTAS · SÓLO ZAPATILLAS',
    title: ['ZAPATILLAS REBAJADAS,', 'LAS QUE MÁS BAJARON PRIMERO.'],
    lead: 'Las zapatillas con descuento en Open Sports, Dexter y Trip Store, ordenadas por cuánto bajaron. Las comprás acá con Mercado Pago y las retirás en el local con tu ticket SPOT.',
    fixed: { category: 'calzado', type: 'Zapatillas', onSale: true },
    defaultSort: 'descuento',
  },
};

const BUY_STEPS = [
  { icon: ShoppingBag, title: 'Elegí tus zapatillas', text: 'Tienda, sucursal y talle.' },
  { icon: QrCode, title: 'Pagá con Mercado Pago', text: 'Tarjeta, débito o dinero en cuenta.' },
  { icon: Store, title: 'Mostrá tu ticket', text: 'Con el QR las retirás en el local.' },
];

const Precios: FunctionComponent<{ mode?: CatalogMode }> = ({ mode = 'comparador' }) => {
  const config = MODES[mode];
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
    document.title = config.documentTitle;
    return () => {
      document.title = previous;
    };
  }, [config.documentTitle]);

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

  // Lo escrito se interpreta en vivo ("remera running mujer" → filtros); Enter lo fija como filtros de verdad.
  const parsed = useMemo(() => parseSearch(query.q ?? '', { ...query, q: '' }), [query]);
  const draftParsed = useMemo(() => parseSearch(draft), [draft]);
  const sort = !parsed.query.sort || parsed.query.sort === 'recomendado' ? config.defaultSort : parsed.query.sort;
  const searchQuery: SearchQuery = useMemo(
    () => ({ ...parsed.query, ...config.fixed, sort, ids: onlyFavorites ? favorites : null, limit: PAGE }),
    [parsed, config.fixed, sort, onlyFavorites, favorites],
  );
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
  const committedRef = useRef(query.q ?? '');
  committedRef.current = query.q ?? '';
  useEffect(() => {
    if (committedRef.current === draft) return;
    const timer = window.setTimeout(() => {
      if (committedRef.current !== draft) update({ q: draft });
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Siempre parte de la URL más reciente (no de la de este render): así un cambio no pisa a otro que llegó antes.
  const update = (patch: Partial<SearchQuery>, extra: Record<string, string | null> = {}) => {
    setParams(
      (previous) => {
        const current = fromParams(previous);
        const next = toParams({ ...current, ...patch });
        // "Marca" y "tipo" dependen del resto: si cambia la categoría, se limpian.
        if ('category' in patch && patch.category !== current.category) {
          if (!('type' in patch)) next.delete('tipo');
          if (!('brand' in patch)) next.delete('marca');
        }
        const favoritos = 'favoritos' in extra ? extra.favoritos : previous.get('favoritos');
        if (favoritos) next.set('favoritos', favoritos);
        return next;
      },
      { replace: true },
    );
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
      navigate({ pathname: `${config.base}/${encodeURIComponent(product.id)}`, search: location.search });
    },
    [navigate, location.search, config.base],
  );
  const close = useCallback(() => {
    if (openedHere.current) navigate(-1);
    else navigate({ pathname: config.base, search: location.search }, { replace: true });
    openedHere.current = false;
  }, [navigate, location.search, config.base]);

  // Enter: las palabras reconocidas pasan a ser filtros (chips) y en el campo queda sólo el texto libre.
  const commitSearch = () => {
    if (draft.trim()) rememberSearch(draft);
    if (!draftParsed.tokens.length) return update({ q: draft });
    const patch: Partial<SearchQuery> = { q: draftParsed.text };
    for (const token of draftParsed.tokens) Object.assign(patch, token.patch);
    setDraft(draftParsed.text);
    update(patch);
  };

  const [shortcut, setShortcut] = useState('');
  useEffect(() => setShortcut(shortcutLabel()), []);

  const sortLabel = SORTS.find((option) => option.key === query.sort)?.label;
  const defaultSortLabel = SORTS.find((option) => option.key === config.defaultSort)?.label ?? 'Recomendado';
  const activeFilters = [
    query.category && { key: 'categoria', label: CATEGORIES[query.category], clear: () => update({ category: null }) },
    query.type && { key: 'tipo', label: query.type, clear: () => update({ type: null }) },
    query.sport && { key: 'deporte', label: query.sport, clear: () => update({ sport: null }) },
    query.gender && { key: 'genero', label: query.gender, clear: () => update({ gender: null }) },
    query.brand && { key: 'marca', label: query.brand, clear: () => update({ brand: null }) },
    query.store && { key: 'tienda', label: STORES[query.store].name, clear: () => update({ store: null }) },
    query.compared && { key: 'comparables', label: 'En varias tiendas', clear: () => update({ compared: false }) },
    query.sort && query.sort !== 'recomendado' && query.sort !== config.defaultSort && { key: 'orden', label: sortLabel ?? query.sort, clear: () => update({ sort: 'recomendado' }) },
    onlyFavorites && { key: 'favoritos', label: 'Favoritos', clear: () => update({}, { favoritos: null }) },
  ]
    .filter(Boolean)
    // Lo que impone la página (sólo zapatillas, sólo ofertas) no se muestra como filtro para sacar.
    .filter((filter) => !(mode !== 'comparador' && (filter as { key: string }).key in { categoria: 1, tipo: 1 })) as { key: string; label: string; clear: () => void }[];

  const items = result?.items ?? [];
  const preview = id ? (items.find((product) => product.id === id) ?? null) : null;
  const total = status?.total ?? 0;
  const firstLoad = status && status.total === 0;

  const stats = status && mode === 'comparador'
    ? [
        { value: total.toLocaleString('es-AR'), label: 'productos de 3 tiendas' },
        { value: status.compared.toLocaleString('es-AR'), label: 'en más de una tienda' },
        { value: timeAgo(status.updatedAt), label: status.refreshing ? 'actualizando ahora…' : 'última actualización' },
      ]
    : [];

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.main} id="contenido">
        <section className={styles.head} aria-labelledby="precios-titulo">
          <p className={styles.kicker}>{config.kicker}</p>
          <h1 id="precios-titulo" className={styles.title}>
            {config.title[0]}
            <br />
            {config.title[1]}
          </h1>
          <p className={styles.lead}>{config.lead}</p>
          {mode !== 'comparador' ? (
            <ol className={styles.steps} aria-label="Cómo comprar con SPOT">
              {BUY_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.stepIcon} aria-hidden="true">
                    <step.icon size={18} />
                  </span>
                  <span>
                    <b>
                      {index + 1}. {step.title}
                    </b>
                    <small>{step.text}</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
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
          <div className={styles.headActions}>
            <button type="button" className={onlyFavorites ? styles.favoritesOn : styles.favorites} aria-pressed={onlyFavorites} onClick={() => update({}, { favoritos: onlyFavorites ? null : '1' })}>
              <Heart size={15} fill={onlyFavorites ? 'currentColor' : 'none'} aria-hidden="true" /> Favoritos {favorites.length ? `(${favorites.length})` : ''}
            </button>
            {mode !== 'comparador' ? (
              <Link to="/tickets" className={styles.favorites}>
                <Ticket size={15} aria-hidden="true" /> Mis tickets
              </Link>
            ) : null}
          </div>
        </section>

        <div className={styles.controls}>
          <form className={styles.smart} role="search" onSubmit={(event) => { event.preventDefault(); commitSearch(); }}>
            <Search size={20} className={styles.smartIcon} aria-hidden="true" />
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribilo como lo dirías: «botines nike baratos»"
              aria-label="Buscar productos"
              autoComplete="off"
              spellCheck={false}
            />
            {draftParsed.tokens.length ? (
              <button type="submit" className={styles.apply}>
                <CornerDownLeft size={14} aria-hidden="true" /> Aplicar
              </button>
            ) : (
              <button type="button" className={styles.spotlight} onClick={() => openSpotSearch({ text: draft })} aria-label="Abrir búsqueda rápida">
                {shortcut}
              </button>
            )}
          </form>
          {draftParsed.tokens.length ? (
            <div className={styles.understood} aria-live="polite">
              <Sparkles size={13} aria-hidden="true" /> Entendimos:
              {draftParsed.tokens.map((token) => (
                <button key={`${token.kind}-${token.label}`} type="button" className={styles.token} onClick={() => setDraft(removeToken(draft, token))} aria-label={`Ignorar ${token.label}`}>
                  {token.label} <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          <GlideTabs
            variant="pills"
            label="Deporte"
            value={parsed.query.sport ?? null}
            onChange={(value) => update({ sport: (value as SearchQuery['sport']) ?? null })}
            items={[{ value: null, label: 'Todos los deportes' }, ...SPORTS.map((sport) => ({ value: sport, label: sport }))]}
          />

          <div className={styles.toolbar}>
            <div className={styles.menus}>
              <FilterMenu label="Para" value={query.gender ?? null} allLabel="Todos" options={GENDERS.map((gender) => ({ value: gender, label: gender }))} onChange={(value) => update({ gender: (value as SearchQuery['gender']) ?? null })} />
              {config.fixed.type ? null : <FilterMenu label="Tipo" value={query.type ?? null} searchable options={(result?.types ?? []).map((type) => ({ value: type.value, label: type.value, count: type.count }))} onChange={(value) => update({ type: value })} />}
              <FilterMenu label="Marca" value={query.brand ?? null} allLabel="Todas" searchable options={(result?.brands ?? []).map((brand) => ({ value: brand.value, label: brand.value, count: brand.count }))} onChange={(value) => update({ brand: value })} />
              <FilterMenu label="Tienda" value={query.store ?? null} allLabel="Las tres" options={(Object.keys(STORES) as StoreId[]).map((store) => ({ value: store, label: STORES[store].name }))} onChange={(value) => update({ store: (value as StoreId | null) ?? null })} />
              <button type="button" className={query.compared ? styles.pillOn : styles.pill} aria-pressed={!!query.compared} onClick={() => update({ compared: !query.compared })}>
                En varias tiendas
              </button>
            </div>
            <FilterMenu
              label="Orden"
              align="end"
              value={query.sort && query.sort !== 'recomendado' && query.sort !== config.defaultSort ? query.sort : null}
              allLabel={defaultSortLabel}
              options={SORTS.filter((option) => option.key !== 'recomendado' && option.key !== config.defaultSort).map((option) => ({ value: option.key, label: option.label }))}
              onChange={(value) => update({ sort: (value as SearchQuery['sort']) ?? 'recomendado' })}
            />
          </div>

          {result && !firstLoad ? (
            <div className={styles.summary} aria-live="polite">
              <span className={styles.count}>
                {result.total.toLocaleString('es-AR')} {result.total === 1 ? 'producto' : 'productos'}
                {onlyFavorites ? ' guardados' : ''}
              </span>
              {activeFilters.map((filter) => (
                <button key={filter.key} type="button" className={styles.activeChip} onClick={filter.clear} aria-label={`Quitar ${filter.label}`}>
                  {filter.label} <X size={12} aria-hidden="true" />
                </button>
              ))}
              {activeFilters.length > 1 ? (
                <button type="button" className={styles.clearAll} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Limpiar todo
                </button>
              ) : null}
            </div>
          ) : null}
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
