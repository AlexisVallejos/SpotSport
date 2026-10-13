import { Link } from 'react-router-dom';
import { inStock, priceFrom } from '../../lib/catalog';
import { formatPrice } from '../../lib/money';
import type { Product } from '../../lib/types';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }: { product: Product }) {
  const price = priceFrom(product);
  const available = inStock(product);
  const multiple = new Set((product.variants ?? []).filter((variant) => variant.is_active).map((variant) => variant.price_cents)).size > 1;
  return (
    <Link to={`/producto/${product.id}`} className={styles.card}>
      <span className={styles.media}>
        {product.images[0] ? <img src={product.images[0]} alt="" loading="lazy" decoding="async" /> : <span className={styles.placeholder}>{product.name.charAt(0)}</span>}
        {!available ? <span className={styles.soldOut}>Sin stock</span> : null}
        {product.featured && available ? <span className={styles.featured}>Destacado</span> : null}
      </span>
      <span className={styles.body}>
        {product.category ? <span className={styles.kicker}>{product.category.name}</span> : null}
        <span className={styles.name}>{product.name}</span>
        {product.merchant ? <span className={styles.merchant}>{product.merchant.name}</span> : null}
        <span className={styles.price}>{price === null ? 'Consultar' : `${multiple ? 'Desde ' : ''}${formatPrice(price)}`}</span>
      </span>
    </Link>
  );
}
