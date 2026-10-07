import { FunctionComponent } from 'react';
import { ProductCard, ProductCardProps } from '../../molecules';
import styles from './ProductGrid.module.css';

export type ProductGridProps = {
  products: ProductCardProps[];
};

const ProductGrid: FunctionComponent<ProductGridProps> = ({ products }) => {
  return (
    <div className={styles.footwearSelection}>
      {products.map((product) => (
        <ProductCard key={product.name} {...product} />
      ))}
    </div>
  );
};

export default ProductGrid;
