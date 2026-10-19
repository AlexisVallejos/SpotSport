import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NotConfigured from '../../components/layout/NotConfigured';
import { Badge, Button, Empty, Loading, Notice } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { getProduct } from '../../lib/api/shop';
import { options, variantLabel } from '../../lib/catalog';
import { formatPrice } from '../../lib/money';
import { isConfigured } from '../../lib/supabaseConfig';
import { useAsync } from '../../lib/useAsync';
import styles from '../pages.module.css';

export default function ProductPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const { data: product, loading, error } = useAsync(() => (isConfigured ? getProduct(id) : Promise.resolve(null)), [id]);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [image, setImage] = useState(0);
  const [added, setAdded] = useState(false);

  const variants = useMemo(() => (product?.variants ?? []).filter((variant) => variant.is_active), [product]);
  const choices = useMemo(() => options(variants), [variants]);

  // Al abrir el producto se elige la primera variante con stock.
  useEffect(() => {
    const first = variants.find((variant) => variant.stock > 0) ?? variants[0];
    setSize(first?.size ?? '');
    setColor(first?.color ?? '');
    setQuantity(1);
    setImage(0);
    setAdded(false);
  }, [variants]);

  if (!isConfigured) return <NotConfigured />;
  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!product) {
    return (
      <Empty title="Este producto no está disponible">
        <p>
          <Link to="/tienda">Volver a la tienda</Link>
        </p>
      </Empty>
    );
  }

  const selected = variants.find((variant) => variant.size === size && variant.color === color);
  // Al cambiar a una variante con menos stock, la cantidad elegida no puede quedar por encima.
  const maxQuantity = selected ? Math.max(1, Math.min(selected.stock, 99)) : 1;
  if (quantity > maxQuantity) setQuantity(maxQuantity);
  const hasStock = (candidate: { size?: string; color?: string }) =>
    variants.some((variant) => variant.stock > 0 && (candidate.size === undefined || variant.size === candidate.size) && (candidate.color === undefined || variant.color === candidate.color));
  const lowStock = selected && selected.stock > 0 && selected.stock <= 3;

  const add = (goToCart: boolean) => {
    if (!selected || selected.stock < 1) return;
    cart.add({
      variantId: selected.id,
      productId: product.id,
      merchantId: product.merchant_id,
      merchantName: product.merchant?.name ?? 'Comercio',
      name: product.name,
      variantLabel: variantLabel(selected),
      image: product.images[0] ?? null,
      priceCents: selected.price_cents,
      quantity,
      maxStock: selected.stock,
    });
    setAdded(true);
    if (goToCart) navigate('/carrito');
  };

  return (
    <div className={styles.detail}>
      <div className={styles.gallery}>
        <div className={styles.mainImage}>{product.images[image] ? <img src={product.images[image]} alt={product.name} /> : <span style={{ fontSize: 96, color: 'var(--accent-text)', fontWeight: 800 }}>{product.name.charAt(0)}</span>}</div>
        {product.images.length > 1 ? (
          <div className={styles.thumbs}>
            {product.images.map((url, index) => (
              <button key={url} type="button" className={`${styles.thumb} ${index === image ? styles.thumbOn : ''}`} onClick={() => setImage(index)} aria-label={`Ver imagen ${index + 1}`}>
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.info}>
        <div>
          {product.category ? <Badge tone="brand">{product.category.name}</Badge> : null}
          <h1>{product.name}</h1>
          {product.merchant ? (
            <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
              Vendido por <Link to={`/tienda?comercio=${product.merchant.id}`}>{product.merchant.name}</Link>
              {product.merchant.city ? ` · ${product.merchant.city}` : ''}
            </p>
          ) : null}
        </div>

        {variants.length === 0 ? (
          <Notice>Este producto todavía no tiene variantes cargadas.</Notice>
        ) : (
          <>
            <div className={styles.bigPrice}>{selected ? formatPrice(selected.price_cents) : 'Elegí una opción'}</div>

            {choices.sizes.length > 0 ? (
              <div>
                <p className={styles.optionLabel}>Talle</p>
                <div className={styles.options}>
                  {choices.sizes.map((value) => (
                    <button key={value} type="button" className={`${styles.option} ${value === size ? styles.optionOn : ''}`} disabled={!hasStock({ size: value })} onClick={() => setSize(value)} aria-pressed={value === size}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {choices.colors.length > 0 ? (
              <div>
                <p className={styles.optionLabel}>Color</p>
                <div className={styles.options}>
                  {choices.colors.map((value) => (
                    <button key={value} type="button" className={`${styles.option} ${value === color ? styles.optionOn : ''}`} disabled={!hasStock({ color: value })} onClick={() => setColor(value)} aria-pressed={value === color}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {selected ? (
              selected.stock > 0 ? (
                <>
                  <div>
                    <p className={styles.optionLabel}>Cantidad</p>
                    <div className={styles.qty}>
                      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Menos">
                        −
                      </button>
                      <span aria-live="polite">{quantity}</span>
                      <button type="button" onClick={() => setQuantity((q) => Math.min(selected.stock, 99, q + 1))} disabled={quantity >= Math.min(selected.stock, 99)} aria-label="Más">
                        +
                      </button>
                    </div>
                    {lowStock ? <p style={{ margin: '8px 0 0', color: 'var(--star)', fontSize: 13 }}>¡Quedan {selected.stock}!</p> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button onClick={() => add(true)}>Comprar</Button>
                    <Button variant="secondary" onClick={() => add(false)}>
                      Agregar al carrito
                    </Button>
                  </div>
                  {added ? <Notice tone="ok">Agregado al carrito. <Link to="/carrito">Ver carrito</Link></Notice> : null}
                </>
              ) : (
                <Notice tone="error">Esta combinación no tiene stock.</Notice>
              )
            ) : (
              <Notice>Esa combinación de talle y color no existe. Elegí otra.</Notice>
            )}
          </>
        )}

        {product.description ? <p className={styles.description}>{product.description}</p> : null}
      </div>
    </div>
  );
}
