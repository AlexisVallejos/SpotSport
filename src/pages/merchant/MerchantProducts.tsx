import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, ButtonLink, Empty, Loading, Notice, PageTitle, Table } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { deleteProduct, listMyProducts, setProductActive, updateStock } from '../../lib/api/merchant';
import { priceFrom } from '../../lib/catalog';
import { formatPrice } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function MerchantProducts() {
  const { merchant } = useAuth();
  const products = useAsync(() => listMyProducts(merchant!.id), [merchant?.id]);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
      products.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar el cambio.');
    }
  };

  return (
    <>
      <PageTitle title="Mis productos" actions={<ButtonLink to="/comercio/productos/nuevo">Publicar producto</ButtonLink>} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      {products.error ? <Notice tone="error">{products.error}</Notice> : null}
      {products.loading ? (
        <Loading />
      ) : (products.data ?? []).length === 0 ? (
        <Empty title="Todavía no publicaste productos">
          <p>
            <Link to="/comercio/productos/nuevo">Publicá el primero</Link>
          </p>
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Variantes y stock</th>
              <th>Precio desde</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(products.data ?? []).map((product) => {
              const price = priceFrom(product);
              return (
                <tr key={product.id}>
                  <td>
                    <div className={styles.productCell}>
                      <span className={styles.productThumb}>{product.images[0] ? <img src={product.images[0]} alt="" /> : product.name.charAt(0)}</span>
                      <span>
                        <strong>{product.name}</strong>
                        <br />
                        <small style={{ color: '#8a8c94' }}>{product.category?.name ?? 'Sin categoría'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {(product.variants ?? []).map((variant) => (
                      <div key={variant.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ minWidth: 110, fontSize: 13 }}>{[variant.size, variant.color].filter(Boolean).join(' · ') || 'Único'}</span>
                        <input
                          className={styles.inlineStock}
                          type="number"
                          min={0}
                          defaultValue={variant.stock}
                          aria-label={`Stock de ${product.name} ${variant.size} ${variant.color}`}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isInteger(value) && value >= 0 && value !== variant.stock) void run(() => updateStock(variant.id, value));
                          }}
                        />
                        {variant.stock <= 3 ? <Badge tone={variant.stock === 0 ? 'bad' : 'warn'}>{variant.stock === 0 ? 'Sin stock' : 'Poco'}</Badge> : null}
                      </div>
                    ))}
                  </td>
                  <td>{price === null ? '—' : formatPrice(price)}</td>
                  <td>
                    <Badge tone={product.is_active ? 'ok' : 'neutral'}>{product.is_active ? 'Publicado' : 'Pausado'}</Badge>
                    {product.featured ? (
                      <>
                        {' '}
                        <Badge tone="brand">Destacado</Badge>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <ButtonLink to={`/comercio/productos/${product.id}`} variant="secondary" small>
                        Editar
                      </ButtonLink>
                      <Button variant="secondary" small onClick={() => void run(() => setProductActive(product.id, !product.is_active))}>
                        {product.is_active ? 'Pausar' : 'Publicar'}
                      </Button>
                      <Button
                        variant="danger"
                        small
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${product.name}"? Los pedidos que ya se hicieron se conservan.`)) void run(() => deleteProduct(product.id));
                        }}>
                        Eliminar
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
