import { FunctionComponent } from 'react';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import ProductGrid from '../ProductGrid/ProductGrid';
import { apparelProducts } from '../../../data/products';
import styles from './ApparelSection.module.css';

const ApparelSection: FunctionComponent = () => {
  return (
    <ContentSection tone="muted">
      <SectionHeading marker="04 / INDUMENTARIA EN MOVIMIENTO" title="VESTITE DE LO QUE TE MUEVE." linkLabel="Explorá la indumentaria" />
      <ProductGrid products={apparelProducts} />
      <div className={styles.category}>Colección conceptual SPOT. Modelos, colores y talles presentados como propuesta de diseño.</div>
    </ContentSection>
  );
};

export default ApparelSection;
