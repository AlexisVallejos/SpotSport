import { FormEvent, FunctionComponent, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { ArrowUpRight, Heart, Star, X } from 'lucide-react';
import { toggleFavorite, useFavorites } from '../../../lib/favorites';
import {
  STORES,
  averageRating,
  formatPrice,
  genderLabel,
  loadDetail,
  loadStoreReviews,
  postReview,
  type Product,
  type ProductDetail,
  type Review,
  type StoreReviews,
} from '../../../lib/precios';
import styles from './PriceDrawer.module.css';

export type PriceDrawerProps = {
  id: string;
  /** Lo que ya mostraba la carta: el panel abre con eso al instante y completa con el detalle. */
  preview?: Product | null;
  onClose: () => void;
};

const EASE = [0.22, 0.68, 0, 1.01] as const; // --spot-ease

const SOURCE_LABEL: Record<Review['source'], string> = { opensports: 'Open Sports', trip: 'Trip Store', dexter: 'Dexter', spot: 'Comunidad SPOT' };

const Stars: FunctionComponent<{ value: number; size?: number }> = ({ value, size = 14 }) => (
  <span className={styles.stars} aria-label={`${value.toFixed(1).replace('.', ',')} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((index) => (
      <Star key={index} size={size} aria-hidden="true" fill={index <= Math.round(value) ? 'currentColor' : 'none'} />
    ))}
  </span>
);

/** Línea del mejor precio de cada día que registramos. */
const History: FunctionComponent<{ points: [string, number][] }> = ({ points }) => {
  const values = points.map(([, value]) => value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lowest = points.find(([, value]) => value === min)!;
  const x = (index: number) => (index / (points.length - 1)) * 300;
  const y = (value: number) => (max === min ? 30 : 6 + ((max - value) / (max - min)) * 48);
  const line = points.map(([, value], index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  return (
    <figure className={styles.history}>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label={`Mejor precio de los últimos ${points.length} días, entre ${formatPrice(min)} y ${formatPrice(max)}`}>
        <path d={`${line} L300,60 L0,60 Z`} className={styles.historyArea} />
        <path d={line} className={styles.historyLine} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        Más bajo registrado: <b>{formatPrice(min)}</b> el {new Date(`${lowest[0]}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
      </figcaption>
    </figure>
  );
};

type ContentProps = {
  product: Product;
  detail: ProductDetail | null;
  storeReviews: StoreReviews | null;
  block: Variants;
  reduce: boolean;
};

/** Foto, precios por tienda, historial y reseñas de un producto. */
const ProductContent: FunctionComponent<ContentProps> = ({ product, detail, storeReviews, block, reduce }) => {
  const [image, setImage] = useState(0);
  const [posted, setPosted] = useState<Review[]>([]);
  const [draft, setDraft] = useState({ author: '', rating: 0, text: '', website: '' });
  const [sending, setSending] = useState(false);
  const [formMessage, setFormMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.rating) return setFormMessage({ ok: false, text: 'Elegí cuántas estrellas le das.' });
    setSending(true);
    setFormMessage(null);
    try {
      const review = await postReview(product.id, draft);
      setPosted((current) => [review, ...current]);
      setDraft({ author: '', rating: 0, text: '', website: '' });
      setFormMessage({ ok: true, text: '¡Gracias! Tu reseña ya está publicada.' });
    } catch (error) {
      setFormMessage({ ok: false, text: error instanceof Error ? error.message : 'No se pudo publicar.' });
    } finally {
      setSending(false);
    }
  };

  const best = product.offers[0];
  // La foto chica de la carta se ve al instante; las grandes llegan con el detalle.
  const images = detail?.images.length ? detail.images : [product.thumb];
  const reviews = [...posted, ...(detail?.reviews ?? []), ...(storeReviews?.reviews ?? [])];
  const loadingReviews = !detail || !storeReviews;
  const average = averageRating(reviews);
  const subtitle = [product.brand, product.type !== 'Zapatillas' ? product.type : null, ...product.sports.slice(0, 2), genderLabel(product.genders)].filter(Boolean).join(' · ');
  const storesWithout = (Object.keys(STORES) as (keyof typeof STORES)[]).filter((store) => !product.offers.some((offer) => offer.store === store));
  const noun = product.category === 'calzado' ? 'este modelo' : 'este producto';

  return (
    <>
      <motion.div className={styles.gallery} variants={block}>
        <div className={styles.photoFrame}>
          <motion.img
            key={image}
            src={images[image] ?? images[0]}
            alt={product.name}
            className={styles.photo}
            initial={reduce ? false : { opacity: 0, scale: 0.92, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
        {product.discount >= 5 ? <span className={styles.discount}>-{product.discount}%</span> : null}
        {images.length > 1 ? (
          <div className={styles.thumbs} role="group" aria-label="Fotos">
            {images.map((src, index) => (
              <button key={src} type="button" className={index === image ? styles.thumbOn : styles.thumb} onClick={() => setImage(index)} aria-label={`Foto ${index + 1}`} aria-pressed={index === image}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
      </motion.div>

      <motion.header className={styles.head} variants={block}>
        <p className={styles.subtitle}>{subtitle}</p>
        <h2 id="precio-titulo" className={styles.title}>
          {product.name}
        </h2>
        <div className={styles.bestLine}>
          <span className={styles.bestPrice}>{formatPrice(product.best)}</span>
          <span className={styles.bestWhere}>
            mejor precio en <b>{STORES[best.store].name}</b>
          </span>
        </div>
        {product.savings > 0 ? <p className={styles.savings}>Comprando acá ahorrás {formatPrice(product.savings)} frente a la tienda más cara.</p> : null}
      </motion.header>

      <motion.section className={styles.section} variants={block} aria-labelledby="precio-tiendas">
        <h3 id="precio-tiendas" className={styles.sectionTitle}>
          Precio en cada tienda
        </h3>
        <ol className={styles.offers}>
          {product.offers.map((offer, index) => (
            <li key={offer.store} className={index === 0 ? styles.offerBest : styles.offer}>
              <div className={styles.offerMain}>
                <span className={styles.storeName}>
                  {STORES[offer.store].name}
                  {index === 0 && product.offers.length > 1 ? <em>Mejor precio</em> : null}
                </span>
                <span className={styles.offerNote}>{offer.installments ?? 'Consultá cuotas en la tienda'}</span>
              </div>
              <div className={styles.offerPrice}>
                <b>{formatPrice(offer.price)}</b>
                {offer.listPrice ? <s>{formatPrice(offer.listPrice)}</s> : null}
                {index > 0 && offer.price > product.best ? <span className={styles.diff}>+{formatPrice(offer.price - product.best)}</span> : null}
              </div>
              <a className={styles.buy} href={offer.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver en ${STORES[offer.store].name} (se abre en otra pestaña)`}>
                Ver<span className={styles.buyStore}> en {STORES[offer.store].name}</span> <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
        {storesWithout.length ? <p className={styles.muted}>No lo encontramos en {storesWithout.map((store) => STORES[store].name).join(' ni ')}.</p> : null}
        {detail && detail.history.length >= 2 ? <History points={detail.history} /> : null}
      </motion.section>

      <motion.section className={styles.section} variants={block} aria-labelledby="precio-resenas">
        <div className={styles.reviewsHead}>
          <h3 id="precio-resenas" className={styles.sectionTitle}>
            Reseñas
          </h3>
          {average ? (
            <span className={styles.average}>
              <Stars value={average} /> {average.toFixed(1).replace('.', ',')} · {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
            </span>
          ) : null}
        </div>

        {loadingReviews && !reviews.length ? (
          <div className={styles.skeleton} role="status" aria-label="Cargando reseñas">
            <span />
            <span />
          </div>
        ) : null}
        {!loadingReviews && reviews.length === 0 ? <p className={styles.muted}>Nadie dejó reseñas de {noun} en Open Sports, Trip Store ni Dexter todavía. Si lo tenés, contá qué te pareció.</p> : null}
        {storeReviews?.errors.length ? <p className={styles.muted}>No pudimos consultar las reseñas de {storeReviews.errors.map((store) => STORES[store].name).join(' ni ')} ahora.</p> : null}

        {reviews.length ? (
          <ul className={styles.reviews}>
            {reviews.map((review, index) => (
              <li key={`${review.source}-${review.date}-${index}`} className={styles.review}>
                <div className={styles.reviewTop}>
                  <b>{review.author}</b>
                  {review.rating ? <Stars value={review.rating} size={12} /> : null}
                </div>
                {review.title ? <p className={styles.reviewTitle}>{review.title}</p> : null}
                <p className={styles.reviewText}>{review.text}</p>
                <span className={styles.reviewSource}>
                  {SOURCE_LABEL[review.source]}
                  {review.date && !Number.isNaN(Date.parse(review.date)) ? ` · ${new Date(review.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <form className={styles.form} onSubmit={submit}>
          <p className={styles.formTitle}>Dejá tu reseña</p>
          <div className={styles.rate} role="radiogroup" aria-label="Estrellas">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.rating === value}
                aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                className={value <= draft.rating ? styles.rateOn : styles.rateOff}
                onClick={() => setDraft((current) => ({ ...current, rating: value }))}
              >
                <Star size={22} fill={value <= draft.rating ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            ))}
          </div>
          <label className={styles.field}>
            <span>Tu nombre</span>
            <input value={draft.author} onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))} maxLength={40} required minLength={2} autoComplete="given-name" />
          </label>
          <label className={styles.field}>
            <span>¿Qué te pareció?</span>
            <textarea value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} maxLength={600} minLength={10} required rows={3} />
          </label>
          {/* Campo trampa: las personas no lo ven, los bots lo llenan. */}
          <input className={styles.trap} tabIndex={-1} autoComplete="off" value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} aria-hidden="true" />
          <button type="submit" className={styles.submit} disabled={sending}>
            {sending ? 'Publicando…' : 'Publicar reseña'}
          </button>
          {formMessage ? (
            <p className={formMessage.ok ? styles.formOk : styles.formError} role="status">
              {formMessage.text}
            </p>
          ) : null}
        </form>
      </motion.section>

      <p className={styles.footnote}>
        {/^(opensports|trip|dexter)-/.test(product.id) ? '' : `Código de modelo ${product.id.toUpperCase()}. `}
        Precios tomados de la web de cada tienda; el precio final es el que figura al comprar.
      </p>
    </>
  );
};

const PriceDrawer: FunctionComponent<PriceDrawerProps> = ({ id, preview, onClose }) => {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [storeReviews, setStoreReviews] = useState<StoreReviews | null>(null);
  const favorite = useFavorites().includes(id);

  // Al abrir: foco en "cerrar", Esc cierra, el foco no se escapa del panel y la página de atrás no scrollea.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([tabindex="-1"]), textarea');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  // El detalle (fotos, historial) responde enseguida; las reseñas de las tiendas tardan unos segundos más.
  useEffect(() => {
    let alive = true;
    loadDetail(id)
      .then((value) => alive && setDetail(value))
      .catch((error: Error) => alive && setDetailError(error.message));
    loadStoreReviews(id)
      .then((value) => alive && setStoreReviews(value))
      .catch(() => alive && setStoreReviews({ reviews: [], errors: [] }));
    return () => {
      alive = false;
    };
  }, [id]);

  const product = detail?.product ?? preview ?? null;

  // El panel entra desde la derecha y sus bloques aparecen escalonados detrás de él.
  const panel: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.2 } } }
    : { hidden: { x: '100%' }, shown: { x: 0, transition: { duration: 0.55, ease: EASE, when: 'beforeChildren', staggerChildren: 0.06 } } };
  const block: Variants = reduce ? { hidden: { opacity: 1 }, shown: { opacity: 1 } } : { hidden: { opacity: 0, y: 18 }, shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

  return (
    <div className={styles.layer}>
      <motion.div className={styles.backdrop} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} aria-hidden="true" />
      <motion.aside
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="precio-titulo"
        variants={panel}
        initial="hidden"
        animate="shown"
        exit={reduce ? { opacity: 0, transition: { duration: 0.15 } } : { x: '100%', transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } }}
      >
        <div className={styles.top}>
          <span className={styles.topLabel}>Comparador SPOT</span>
          <div className={styles.topActions}>
            <button type="button" className={favorite ? styles.saveOn : styles.save} aria-pressed={favorite} onClick={() => toggleFavorite(id)}>
              <Heart size={16} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" /> {favorite ? 'Guardado' : 'Guardar'}
            </button>
            <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>
        </div>

        {product ? (
          <ProductContent key={product.id} product={product} detail={detail} storeReviews={storeReviews} block={block} reduce={!!reduce} />
        ) : detailError ? (
          <p className={styles.muted} role="alert">
            {detailError}
          </p>
        ) : (
          <div className={styles.skeleton} role="status" aria-label="Cargando producto">
            <span className={styles.skeletonPhoto} />
            <span />
            <span />
          </div>
        )}
      </motion.aside>
    </div>
  );
};

export default PriceDrawer;
