import { FunctionComponent } from 'react';
import { ColorSwatch, Icon, Label, SwatchColor, Text } from '../../atoms';
import styles from './ProductCard.module.css';

export type ProductImageFit = 'default' | 'narrow';

export type ProductCardProps = {
  badge: string;
  category: string;
  name: string;
  description: string;
  colors: SwatchColor[];
  collectionNote: string;
  imageFit?: ProductImageFit;
  image?: string;
};

const imageClass: Record<ProductImageFit, string> = {
  default: styles.productPhotographIcon,
  narrow: styles.productPhotographIcon3,
};

const ProductCard: FunctionComponent<ProductCardProps> = ({
  badge,
  category,
  name,
  description,
  colors,
  collectionNote,
  imageFit = 'default',
  image,
}) => {
  return (
    <div className={styles.productCard}>
      <div className={styles.productVisual}>
        <img className={imageClass[imageFit]} src={image} alt="" />
        <div className={styles.productActions}>
          <Label>{badge}</Label>
          <Icon />
        </div>
      </div>
      <div className={styles.productDetails}>
        <div className={styles.category}>{category}</div>
        <div className={styles.productName}>{name}</div>
        <div className={styles.description5}>{description}</div>
        <div className={styles.colors}>
          {colors.map((color, index) => (
            <ColorSwatch key={`${color}-${index}`} color={color} />
          ))}
          <Text>{collectionNote}</Text>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
