import { FunctionComponent, useState } from 'react';
import { Heart } from 'lucide-react';
import { ColorSwatch, Label, SwatchColor } from '../../atoms';
import ProductViewer from '../ProductViewer/ProductViewer';
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
  return (
    <article className={styles.productCard}>
      <div className={styles.productVisual}>
        <ProductViewer name={name} image={image} color={selectedColor} baseColor={colors[0]} />
        <div className={styles.productActions}>
          <Label>{badge}</Label>
          <button type="button" className={styles.favorite} aria-label={`${favorite ? 'Quitar' : 'Guardar'} ${name} ${favorite ? 'de' : 'en'} favoritos`} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className={styles.productDetails}>
        <div className={styles.category}>{category}</div>
        <h3 className={styles.productName}>{name}</h3>
        <div className={styles.description5}>{description}</div>
        <div className={styles.colorSelection}>
          <div className={styles.colors} role="group" aria-label={`Colores de ${name}`}>
            {colors.map(color => <ColorSwatch key={color} color={color} selected={selectedColor === color} onSelect={() => setSelectedColor(color)} />)}
          </div>
          <span className={styles.colorName} aria-live="polite">{productColors[selectedColor].label}</span>
        </div>
        <span className={styles.conceptNote}>{selectedColor !== colors[0] ? 'Vista de color conceptual' : collectionNote}</span>
      </div>
    </article>
  );
};

export default ProductCard;
