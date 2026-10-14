import { FunctionComponent } from 'react';
import { ArrowUpRight, Heart } from 'lucide-react';
import { toggleFavorite, useFavorites } from '../../../lib/favorites';
import { STORES, formatPrice, genderLabel, type Product } from '../../../lib/precios';
import styles from './PriceCard.module.css';

export type PriceCardProps = {
  product: Product;
  onOpen: (product: Product) => void;
};

// Toda la carta es clickeable con un solo botón (el del nombre) que se estira por encima;
// el corazón queda arriba de ese botón para poder guardarla sin abrirla.
const PriceCard: FunctionComponent<PriceCardProps> = ({ product, onOpen }) => {
  const favorite = useFavorites().includes(product.id);
  const best = product.offers[0];
  const stores = product.offers.length;
  const details = [product.sports[0], genderLabel(product.genders)].filter(Boolean).join(' · ');

  return (
    <article className={styles.card}>
      <div className={styles.visual}>
        <img src={product.thumb} alt="" loading="lazy" decoding="async" />
        <div className={styles.tags}>
          {product.discount >= 5 ? <span className={styles.discount}>-{product.discount}%</span> : <span />}
          <span className={stores > 1 ? styles.stores : styles.storesSingle}>{stores > 1 ? `${stores} tiendas` : '1 tienda'}</span>
        </div>
        <button
          type="button"
          className={styles.favorite}
          aria-pressed={favorite}
          aria-label={`${favorite ? 'Quitar' : 'Guardar'} ${product.name} ${favorite ? 'de' : 'en'} favoritos`}
          onClick={() => toggleFavorite(product.id)}
        >
          <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className={styles.body}>
        <p className={styles.brand}>
          <b>{product.brand}</b>
          {details && <span>{details}</span>}
        </p>
        <h3 className={styles.name}>
          <button type="button" className={styles.open} onClick={() => onOpen(product)} aria-haspopup="dialog">
            {product.title}
          </button>
        </h3>
        <div className={styles.priceRow}>
          <div>
            <span className={styles.priceLabel}>Mejor precio · {STORES[best.store].name}</span>
            <span className={styles.price}>
              {formatPrice(product.best)}
              {best.listPrice ? <s>{formatPrice(best.listPrice)}</s> : null}
            </span>
          </div>
          <span className={styles.go} aria-hidden="true">
            <ArrowUpRight size={16} />
          </span>
        </div>
        <p className={styles.saving}>{product.savings > 0 ? `Ahorrás ${formatPrice(product.savings)} frente a la más cara` : stores > 1 ? 'Mismo precio en todas' : 'Sin otra tienda para comparar'}</p>
      </div>
    </article>
  );
};

export default PriceCard;
