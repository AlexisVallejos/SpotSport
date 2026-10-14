import { FunctionComponent } from 'react';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import PriceShowcase from '../PriceShowcase/PriceShowcase';
import { preciosLink } from '../../../lib/precios';
import styles from './ApparelSection.module.css';

const ApparelSection: FunctionComponent = () => {
  return (
    <ContentSection tone="muted" id="indumentaria" labelledBy="indumentaria-titulo">
      <SectionHeading id="indumentaria-titulo" marker="INDUMENTARIA EN MOVIMIENTO" title="VESTITE DE LO QUE TE MUEVE." linkLabel="Explorá la indumentaria" linkHref={preciosLink({ category: 'indumentaria' })} />
      <PriceShowcase query={{ category: 'indumentaria' }} />
      <p className={styles.category}>Remeras, buzos, camperas y más de Open Sports, Dexter y Trip Store, con el precio más bajo primero. Tocá una prenda para ver los precios de cada tienda.</p>
    </ContentSection>
  );
};

export default ApparelSection;
