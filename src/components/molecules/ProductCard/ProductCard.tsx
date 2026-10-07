import { FunctionComponent } from 'react';
import { ColorSwatch, Icon, Label, SwatchColor, Text } from '../../atoms';
import ProductViewer from '../ProductViewer/ProductViewer';
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
  return (
    <article className={styles.productCard}>
      <div className={styles.productVisual}>
        <ProductViewer name={name} image={image} />
        <div className={styles.productActions}>
          <Label>{badge}</Label>
          <Icon name="arrowUpRight" />
        </div>
      </div>
      <div className={styles.productDetails}>
        <div className={styles.category}>{category}</div>
        <h3 className={styles.productName}>{name}</h3>
        <div className={styles.description5}>{description}</div>
        <div className={styles.colors}>
          {colors.map((color, index) => (
            <ColorSwatch key={`${color}-${index}`} color={color} />
          ))}
          <Text>{collectionNote}</Text>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
