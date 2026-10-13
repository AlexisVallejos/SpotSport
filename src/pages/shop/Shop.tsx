import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import ProductCard from '../../components/shop/ProductCard';
import { Empty, Loading, Notice, PageTitle } from '../../components/ui';
import { listCategories, listProducts } from '../../lib/api/shop';
import { isConfigured } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

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

  if (!isConfigured) return <NotConfigured />;

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
      ) : (products.data ?? []).length === 0 ? (
        <Empty title="No encontramos productos">
          <p>{q || categorySlug ? 'Probá con otra búsqueda o categoría.' : 'Todavía no hay productos publicados. Volvé pronto.'}</p>
        </Empty>
      ) : (
        <div className={styles.productGrid}>
          {(products.data ?? []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
