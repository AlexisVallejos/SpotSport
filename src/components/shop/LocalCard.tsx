import { formatPrice, STORES, type Product } from '../../lib/precios';
import styles from './ProductCard.module.css';

/**
 * Producto publicado por un local (Open Sports, Dexter, Trip Store). No se compra en SPOT:
 * cada botón lleva al sitio del local con el precio que figura en su listado.
 */
export default function LocalCard({ product }: { product: Product }) {
  return (
    <article className={styles.card}>
      <span className={styles.media}>
        {product.thumb ? <img src={product.thumb} alt="" loading="lazy" decoding="async" /> : <span className={styles.placeholder}>{product.name.charAt(0)}</span>}
      </span>
      <span className={styles.body}>
        <span className={styles.kicker}>{product.brand}</span>
        <span className={styles.name}>{product.title}</span>
        <span className={styles.price}>
          {product.offers.length > 1 ? 'Desde ' : ''}
          {formatPrice(product.best)}
        </span>
        <span className={styles.offers}>
          {product.offers.map((offer) => (
            <a key={offer.store} href={offer.url} target="_blank" rel="noopener noreferrer" className={styles.offer}>
              <span>Ver en {STORES[offer.store].name}</span>
              <span>{formatPrice(offer.price)}</span>
            </a>
          ))}
        </span>
      </span>
    </article>
  );
}
