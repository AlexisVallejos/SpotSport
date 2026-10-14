import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import LocalCard from '../../components/shop/LocalCard';
import ProductCard from '../../components/shop/ProductCard';
import { Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { listCategories, listProducts } from '../../lib/api/shop';
import { preciosLink, searchProducts, type SearchQuery } from '../../lib/precios';
import { isConfigured } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

/** Categorías de la tienda → filtros de la API de precios de los locales. */
const LOCAL_FILTERS: Record<string, SearchQuery> = {
  running: { sport: 'Running' },
  entrenamiento: { sport: 'Training' },
  futbol: { sport: 'Fútbol' },
  sportstyle: { sport: 'Urbana' },
  indumentaria: { category: 'indumentaria' },
  accesorios: { category: 'accesorios' },
};

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const categorySlug = params.get('cat') ?? '';
  const merchantId = params.get('comercio') ?? '';
  const [draft, setDraft] = useState(q);

  useEffect(() => setDraft(q), [q]);

  const categories = useAsync(() => (isConfigured ? listCategories() : Promise.resolve([])), []);
  const categoryId = useMemo(() => categories.data?.find((category) => category.slug === categorySlug)?.id, [categories.data, categorySlug]);
  const products = useAsync(
    () => (isConfigured ? listProducts({ q, categoryId, merchantId: merchantId || undefined }) : Promise.resolve([])),
    [q, categoryId, merchantId, categories.loading],
  );

  const localQuery = useMemo<SearchQuery>(() => ({ q, ...LOCAL_FILTERS[categorySlug] }), [q, categorySlug]);
  // Sin comercio elegido: los productos de un comercio afiliado no se mezclan con los de los locales.
  const locals = useAsync(() => (merchantId ? Promise.resolve(null) : searchProducts({ ...localQuery, limit: 24 })), [localQuery, merchantId]);

  if (!isConfigured) return <NotConfigured />;
  const hasLocals = (locals.data?.items.length ?? 0) > 0;
  const filtered = Boolean(q || categorySlug);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
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
      <div className={styles.filters} role="group" aria-label="Categorías">
        <button type="button" className={`${styles.chip} ${!categorySlug ? styles.chipOn : ''}`} onClick={() => update({ cat: '' })}>
          Todo
        </button>
        {(categories.data ?? []).map((category) => (
          <button key={category.id} type="button" className={`${styles.chip} ${categorySlug === category.slug ? styles.chipOn : ''}`} onClick={() => update({ cat: category.slug })}>
            {category.name}
          </button>
        ))}
        {merchantId ? (
          <button type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => update({ comercio: '' })}>
            Un solo comercio ×
          </button>
        ) : null}
      </div>

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
