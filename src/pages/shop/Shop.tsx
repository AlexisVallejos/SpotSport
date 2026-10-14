import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import NeuralCategories from '../../components/organisms/NeuralCategories/NeuralCategories';
import LocalCard from '../../components/shop/LocalCard';
import ProductCard from '../../components/shop/ProductCard';
import { Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { listCategories, listProducts } from '../../lib/api/shop';
import { fromParams, loadStatus, preciosLink, searchProducts, toParams, type CatalogStatus, type SearchQuery, type Sport } from '../../lib/precios';
import { isConfigured } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

/** Neurona elegida → categoría de la tienda (Supabase) para filtrar también a los comercios afiliados. */
const SPORT_SLUGS: Partial<Record<Sport, string>> = { Running: 'running', Training: 'entrenamiento', Fútbol: 'futbol', Urbana: 'sportstyle' };

function shopSlug(query: SearchQuery): string | undefined {
  if (query.sport && SPORT_SLUGS[query.sport]) return SPORT_SLUGS[query.sport];
  if (query.category === 'indumentaria' || query.category === 'accesorios') return query.category;
  return undefined;
}

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const merchantId = params.get('comercio') ?? '';
  const [draft, setDraft] = useState(q);
  const [status, setStatus] = useState<CatalogStatus | null>(null);

  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    loadStatus().then(setStatus, () => setStatus(null));
  }, []);

  // Las categorías salen de la red neuronal del comparador (categoria, tipo y deporte en la URL, igual que /precios).
  const filters = fromParams(params);
  const filterKey = toParams({ category: filters.category, type: filters.type, sport: filters.sport }).toString();
  const localQuery = useMemo<SearchQuery>(() => ({ q, category: filters.category, type: filters.type, sport: filters.sport }), [q, filterKey]);
  const slug = shopSlug(localQuery);

  const categories = useAsync(() => (isConfigured ? listCategories() : Promise.resolve([])), []);
  const categoryId = useMemo(() => categories.data?.find((category) => category.slug === slug)?.id, [categories.data, slug]);
  // Calzado o un tipo sin equivalente en la tienda: no hay productos afiliados que mostrar con ese filtro.
  const unmatched = Boolean((localQuery.category || localQuery.type || localQuery.sport) && !categoryId);
  const products = useAsync(
    () => (isConfigured && !unmatched ? listProducts({ q, categoryId, merchantId: merchantId || undefined }) : Promise.resolve([])),
    [q, categoryId, unmatched, merchantId, categories.loading],
  );

  // Sin comercio elegido: los productos de un comercio afiliado no se mezclan con los de los locales.
  const locals = useAsync(() => (merchantId ? Promise.resolve(null) : searchProducts({ ...localQuery, limit: 24 })), [localQuery, merchantId]);

  if (!isConfigured) return <NotConfigured />;
  const hasLocals = (locals.data?.items.length ?? 0) > 0;
  const filtered = Boolean(q || localQuery.category || localQuery.sport);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const selectNeuron = (patch: Partial<SearchQuery>) => {
    const next = toParams({ category: filters.category, type: filters.type, sport: filters.sport, ...patch });
    update({ categoria: next.get('categoria') ?? '', tipo: next.get('tipo') ?? '', deporte: next.get('deporte') ?? '' });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update({ q: draft.trim() });
  };

  return (
    <>
      <PageTitle title="Tienda" subtitle="Productos de comercios deportivos de todo el país." />
      <form onSubmit={submit} className={styles.filters} role="search">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar productos"
          style={{ flex: '1 1 240px', minHeight: 36, padding: '0 12px', background: '#0c0c0c', border: '1px solid #2f2f2f', color: '#fff' }}
        />
      </form>
      <NeuralCategories status={status} query={localQuery} onSelect={selectNeuron} />
      {merchantId ? (
        <div className={styles.filters}>
          <button type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => update({ comercio: '' })}>
            Un solo comercio ×
          </button>
        </div>
      ) : null}

      {products.error ? <Notice tone="error">{products.error}</Notice> : null}
      {products.loading ? (
        <Loading label="Buscando productos…" />
      ) : (products.data ?? []).length > 0 ? (
        <div className={styles.productGrid}>
          {(products.data ?? []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : !hasLocals && !locals.loading ? (
        <Empty title="No encontramos productos">
          <p>{filtered ? 'Probá con otra búsqueda o categoría.' : 'Todavía no hay productos publicados. Volvé pronto.'}</p>
        </Empty>
      ) : null}

      {hasLocals ? (
        <section aria-label="Productos en locales" style={{ marginTop: 40 }}>
          <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 32, textTransform: 'uppercase' }}>En locales</h2>
              <p style={{ margin: '4px 0 0', color: '#8a8c94' }}>Precios publicados por Open Sports, Dexter y Trip Store. La compra se hace en el sitio de cada local.</p>
            </div>
            <Link to={preciosLink(localQuery)} style={{ color: '#ff7900' }}>
              Ver los {locals.data!.total.toLocaleString('es-AR')} en el comparador →
            </Link>
          </header>
          <div className={styles.productGrid}>
            {locals.data!.items.map((product) => (
              <LocalCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
