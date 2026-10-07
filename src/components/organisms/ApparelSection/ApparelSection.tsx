import { FunctionComponent } from 'react';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import ProductGrid from '../ProductGrid/ProductGrid';
import { apparelProducts } from '../../../data/products';
import styles from './ApparelSection.module.css';

const ApparelSection: FunctionComponent = () => {
  return (
    <ContentSection tone="muted" id="indumentaria" labelledBy="indumentaria-titulo">
      <SectionHeading id="indumentaria-titulo" marker="04 / INDUMENTARIA EN MOVIMIENTO" title="VESTITE DE LO QUE TE MUEVE." linkLabel="Explorá la indumentaria" />
      <ProductGrid products={apparelProducts} />
      <p className={styles.category}>Colección conceptual SPOT. Modelos, colores y talles presentados como propuesta de diseño.</p>
    </ContentSection>
  );
};

export default ApparelSection;
