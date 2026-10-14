import { FunctionComponent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Backpack, Clock, CornerDownLeft, Footprints, Search, Shirt, Sparkles, X } from 'lucide-react';
import { clearRecentSearches, onOpenSpotSearch, recentSearches, rememberSearch } from '../../../lib/spotSearch';
import { parseSearch, removeToken } from '../../../lib/smartQuery';
import { CATEGORIES, SPORTS, STORES, formatPrice, genderLabel, loadStatus, preciosLink, searchProducts, toParams, type CatalogStatus, type Category, type Product, type SearchQuery } from '../../../lib/precios';
import styles from './SpotSearch.module.css';

const LIMIT = 6;
const EXAMPLES = ['botines nike baratos', 'remera running mujer', 'camiseta boca', 'samba', 'mochila adidas', 'zapatillas urbanas en oferta'];
const CATEGORY_ICON: Record<Category, typeof Footprints> = { calzado: Footprints, indumentaria: Shirt, accesorios: Backpack };

/** Placeholder que va mostrando ejemplos reales de lo que se puede escribir. */
const RotatingHint: FunctionComponent<{ reduce: boolean }> = ({ reduce }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % EXAMPLES.length), 2600);
    return () => window.clearInterval(timer);
  }, [reduce]);
  return (
    <span className={styles.hint} aria-hidden="true">
      Probá «
      <span className={styles.hintWindow}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={EXAMPLES[index]}
            className={styles.hintWord}
            initial={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
            animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
          >
            {EXAMPLES[index]}
          </motion.span>
        </AnimatePresence>
      </span>
      »
    </span>
  );
};

// Búsqueda Spotlight de SPOT: ⌘K, "/" o el buscador del menú. Entiende lo que escribís y lo convierte en filtros.
const SpotSearch: FunctionComponent = () => {
  const navigate = useNavigate();
  const reduce = !!useReducedMotion();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [result, setResult] = useState<{ total: number; items: Product[]; key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const parsed = useMemo(() => parseSearch(text), [text]);
  const queryKey = JSON.stringify(parsed.query);
  const exploring = !parsed.text && parsed.tokens.length === 0;

  const show = (initial = '') => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    setText(initial);
    setRecent(recentSearches());
    setOpen(true);
  };
  const close = () => setOpen(false);

  // Atajos: ⌘K / Ctrl K abre o cierra; "/" abre si no estás escribiendo en otro campo.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((state) => {
          if (!state) {
            restoreRef.current = document.activeElement as HTMLElement | null;
            setRecent(recentSearches());
          }
          return !state;
        });
      } else if (event.key === '/' && !typing && !open) {
        event.preventDefault();
        show();
      }
    };
    document.addEventListener('keydown', onKey);
    const off = onOpenSpotSearch(({ text: initial }) => show(initial ?? ''));
    return () => {
      document.removeEventListener('keydown', onKey);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Abierta: foco en el campo, la página de atrás no scrollea; al cerrar, el foco vuelve a donde estaba.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus({ preventScroll: true });
    if (!status) loadStatus().then(setStatus, () => undefined);
    return () => {
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resultados en vivo, con una espera mínima para no pedir uno por tecla.
  useEffect(() => {
    if (!open || exploring) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchProducts({ ...parsed.query, limit: LIMIT }, controller.signal)
        .then((value) => {
          setResult({ total: value.total, items: value.items, key: queryKey });
          setFailed(false);
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 90);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queryKey, exploring]);

  const items = !exploring && result ? result.items : [];
  const base: SearchQuery = { ...parsed.query };

  const go = (path: string) => {
    if (text.trim()) rememberSearch(text);
    setOpen(false);
    navigate(path);
  };
  const openProduct = (product: Product) => go(`/precios/${encodeURIComponent(product.id)}?${toParams(base)}`);
  const seeAll = () => go(preciosLink(base));

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && panelRef.current) {
      // El foco no se escapa de la paleta mientras está abierta.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Enter' && !exploring) {
      event.preventDefault();
      if (items[active] && !event.metaKey && !event.ctrlKey) openProduct(items[active]);
      else seeAll();
    }
  };

  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.38 };

  return (
    <AnimatePresence>
      {open ? (
        <div className={styles.layer}>
          <motion.div className={styles.backdrop} onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar productos"
            onKeyDown={onKey}
            // El vidrio "se materializa": escala, desenfoque y opacidad juntos, y se va por el mismo camino.
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8, filter: 'blur(6px)' }}
            transition={spring}
          >
            <div className={styles.inputRow}>
              <Search size={20} className={styles.inputIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                className={styles.input}
                value={text}
                onChange={(event) => setText(event.target.value)}
                role="combobox"
                aria-expanded={!exploring}
                aria-controls={listId}
                aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                aria-label={`Buscar en ${status ? status.total.toLocaleString('es-AR') : 'miles de'} productos`}
                autoComplete="off"
                spellCheck={false}
              />
              {!text ? <RotatingHint reduce={reduce} /> : null}
              {text ? (
                <button type="button" className={styles.clear} onClick={() => setText('')} aria-label="Borrar búsqueda">
                  <X size={16} />
                </button>
              ) : null}
              <kbd className={styles.kbd}>esc</kbd>
            </div>

            <AnimatePresence initial={false}>
              {parsed.tokens.length ? (
                <motion.div className={styles.tokens} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
                  <span className={styles.tokensLabel}>
                    <Sparkles size={13} aria-hidden="true" /> Entendimos
                  </span>
                  <AnimatePresence initial={false}>
                    {parsed.tokens.map((token) => (
                      <motion.button
                        key={`${token.kind}-${token.label}`}
                        type="button"
                        layout
                        className={styles.token}
                        data-kind={token.kind}
                        onClick={() => setText(removeToken(text, token))}
                        aria-label={`Quitar ${token.label}`}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        transition={spring}
                      >
                        {token.label} <X size={12} aria-hidden="true" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className={styles.body}>
              {exploring ? (
                <div className={styles.explore}>
                  <section aria-label="Categorías">
                    <p className={styles.groupTitle}>Explorá</p>
                    <div className={styles.categories}>
                      {(Object.keys(CATEGORIES) as Category[]).map((category) => {
                        const Icon = CATEGORY_ICON[category];
                        return (
                          <button key={category} type="button" className={styles.category} onClick={() => go(preciosLink({ category }))}>
                            <Icon size={22} aria-hidden="true" />
                            <span>{CATEGORIES[category]}</span>
                            <small>{status ? `${status.byCategory[category].toLocaleString('es-AR')} productos` : ' '}</small>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section aria-label="Deportes">
                    <p className={styles.groupTitle}>Por deporte</p>
                    <div className={styles.chips}>
                      {SPORTS.map((sport) => (
                        <button key={sport} type="button" className={styles.chip} onClick={() => go(preciosLink({ sport }))}>
                          {sport}
                        </button>
                      ))}
                    </div>
                  </section>
                  <div className={styles.columns}>
                    {recent.length ? (
                      <section aria-label="Búsquedas recientes">
                        <p className={styles.groupTitle}>
                          Recientes
                          <button
                            type="button"
                            className={styles.groupAction}
                            onClick={() => {
                              clearRecentSearches();
                              setRecent([]);
                            }}
                          >
                            Borrar
                          </button>
                        </p>
                        {recent.map((item) => (
                          <button key={item} type="button" className={styles.suggestion} onClick={() => setText(item)}>
                            <Clock size={15} aria-hidden="true" /> {item}
                          </button>
                        ))}
                      </section>
                    ) : null}
                    <section aria-label="Ejemplos">
                      <p className={styles.groupTitle}>Escribilo como lo dirías</p>
                      {EXAMPLES.slice(0, recent.length ? 3 : 5).map((item) => (
                        <button key={item} type="button" className={styles.suggestion} onClick={() => setText(item)}>
                          <Sparkles size={15} aria-hidden="true" /> {item}
                        </button>
                      ))}
                    </section>
                  </div>
                </div>
              ) : failed ? (
                <p className={styles.empty}>No pudimos buscar ahora. Probá de nuevo en un momento.</p>
              ) : result && result.key === queryKey && items.length === 0 ? (
                <div className={styles.empty}>
                  <p>
                    No encontramos «{text.trim()}» en Open Sports, Dexter ni Trip Store.
                  </p>
                  {parsed.tokens.length ? <p className={styles.emptyHint}>Probá quitando algún filtro de arriba.</p> : null}
                </div>
              ) : (
                <ul id={listId} role="listbox" aria-label="Resultados" className={styles.results} aria-busy={loading}>
                  {items.map((product, index) => (
                    <li
                      key={product.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className={styles.row}
                      onPointerMove={() => setActive(index)}
                      onClick={() => openProduct(product)}
                    >
                      {index === active ? <motion.span layoutId="spot-active" className={styles.rowHighlight} transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.3 }} aria-hidden="true" /> : null}
                      <img src={product.thumb} alt="" className={styles.thumb} loading="lazy" />
                      <span className={styles.rowText}>
                        <b>{product.name}</b>
                        <span>{[product.type !== 'Zapatillas' ? product.type : null, product.sports[0], genderLabel(product.genders)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={styles.rowPrice}>
                        <b>{formatPrice(product.best)}</b>
                        <span>{product.offers.length > 1 ? `${product.offers.length} tiendas` : STORES[product.offers[0].store].name}</span>
                      </span>
                      {product.savings > 0 ? <span className={styles.saving}>−{formatPrice(product.savings)}</span> : null}
                    </li>
                  ))}
                  {!result && loading
                    ? Array.from({ length: 4 }, (_, index) => (
                        <li key={index} className={styles.skeleton} aria-hidden="true">
                          <span />
                          <span />
                        </li>
                      ))
                    : null}
                </ul>
              )}
            </div>

            <footer className={styles.footer}>
              <span className={styles.keys} aria-hidden="true">
                <kbd>↑</kbd>
                <kbd>↓</kbd> moverte <kbd>↵</kbd> abrir <kbd>esc</kbd> cerrar
              </span>
              {!exploring && result && result.total > 0 ? (
                <button type="button" className={styles.all} onClick={seeAll}>
                  Ver los {result.total.toLocaleString('es-AR')} resultados <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : (
                <span className={styles.footNote}>
                  <CornerDownLeft size={13} aria-hidden="true" /> Open Sports · Dexter · Trip Store
                </span>
              )}
            </footer>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};

export default SpotSearch;
