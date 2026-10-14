import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Empty, Loading, Notice, PageTitle, Table, TextField } from '../../components/ui';
import { listAllProducts, setProductFlags } from '../../lib/api/admin';
import { priceFrom } from '../../lib/catalog';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function AdminProducts() {
  const products = useAsync(listAllProducts, []);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (products.data ?? []).filter((product) => !text || product.name.toLowerCase().includes(text) || (product.merchant?.name ?? '').toLowerCase().includes(text));
  }, [products.data, query]);

  const flag = async (id: string, flags: { featured?: boolean; is_active?: boolean }) => {
    setError('');
    try {
      await setProductFlags(id, flags);
      products.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  return (
    <>
      <PageTitle title="Productos" subtitle="Los destacados aparecen en la portada de la tienda." />
      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <TextField label="Buscar" placeholder="Producto o comercio" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {products.error ? <Notice tone="error">{products.error}</Notice> : null}
      {products.loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty title="No hay productos" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Comercio</th>
              <th>Precio desde</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((product) => {
              const price = priceFrom(product);
              return (
                <tr key={product.id}>
                  <td>
                    <div className={styles.productCell}>
                      <span className={styles.productThumb}>{product.images[0] ? <img src={product.images[0]} alt="" /> : product.name.charAt(0)}</span>
                      <Link to={`/producto/${product.id}`}>
                        <strong>{product.name}</strong>
                      </Link>
                    </div>
                  </td>
                  <td>{product.merchant?.name ?? '—'}</td>
                  <td>{price === null ? '—' : formatPrice(price)}</td>
                  <td>
                    <Badge tone={product.is_active ? 'ok' : 'neutral'}>{product.is_active ? 'Publicado' : 'Pausado'}</Badge>{' '}
                    {product.featured ? <Badge tone="brand">Destacado</Badge> : null}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Button variant="secondary" small onClick={() => void flag(product.id, { featured: !product.featured })}>
                        {product.featured ? 'Quitar destacado' : 'Destacar'}
                      </Button>
                      <Button variant={product.is_active ? 'danger' : 'secondary'} small onClick={() => void flag(product.id, { is_active: !product.is_active })}>
                        {product.is_active ? 'Pausar' : 'Publicar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
