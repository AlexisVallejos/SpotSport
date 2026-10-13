import { FunctionComponent, useState } from 'react';
import { ArrowUpRight, Heart } from 'lucide-react';
import { ColorSwatch, SwatchColor } from '../../atoms';
import ProductViewer from '../ProductViewer/ProductViewer';
import SpotlightCard from '../../reactbits/SpotlightCard';
import { productColors } from '../../../data/productColors';
import styles from './ProductCard.module.css';

export type ProductCardProps = {
  badge: string;
  category: string;
  name: string;
  description: string;
  colors: SwatchColor[];
  collectionNote: string;
  image?: string;
};

const ProductCard: FunctionComponent<ProductCardProps> = ({
  badge,
  category,
  name,
  description,
  colors,
  collectionNote,
  image,
}) => {
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [favorite, setFavorite] = useState(() => {
    try { return localStorage.getItem(`spot-favorite:${name}`) === 'true'; } catch { return false; }
  });
  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    try { localStorage.setItem(`spot-favorite:${name}`, String(next)); } catch { /* Keep the control usable without storage. */ }
  };
  const [discipline, line] = category.split(' / ');
  return (
    <SpotlightCard className={styles.card} theme="light" spotlightColor="rgba(255, 121, 0, 0.16)">
      <article className={styles.productCard}>
        <div className={styles.productVisual}>
          <span className={styles.halo} aria-hidden="true" />
          <ProductViewer name={name} image={image} color={selectedColor} baseColor={colors[0]} />
          <div className={styles.productActions}>
            <span className={styles.badge}>{badge}</span>
            <button type="button" className={styles.favorite} aria-label={`${favorite ? 'Quitar' : 'Guardar'} ${name} ${favorite ? 'de' : 'en'} favoritos`} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>
          </div>
        </div>
        <div className={styles.productDetails}>
          <div className={styles.category}><b>{discipline}</b>{line && <span>{line}</span>}</div>
          <h3 className={styles.productName}>{name}</h3>
          <p className={styles.description}>{description}</p>
          <div className={styles.colorSelection}>
            <div className={styles.colors} role="group" aria-label={`Colores de ${name}`}>
              {colors.map(color => <ColorSwatch key={color} color={color} selected={selectedColor === color} onSelect={() => setSelectedColor(color)} />)}
            </div>
            <span className={styles.colorName} aria-live="polite">{productColors[selectedColor].label}</span>
          </div>
          <div className={styles.footer}>
            <span className={styles.conceptNote}>{selectedColor !== colors[0] ? 'Vista de color conceptual' : collectionNote}</span>
            <span className={styles.go} aria-hidden="true"><ArrowUpRight size={16} /></span>
          </div>
        </div>
      </article>
    </SpotlightCard>
  );
};

export default ProductCard;
