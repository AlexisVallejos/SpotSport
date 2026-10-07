import { FunctionComponent } from 'react';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import CollectionFilters from '../CollectionFilters/CollectionFilters';
import ProductGrid from '../ProductGrid/ProductGrid';
import { footwearFilters, footwearProducts } from '../../../data/products';

const FootwearSection: FunctionComponent = () => {
  return (
    <ContentSection tone="white">
      <SectionHeading marker="02 / NUEVAS SILUETAS" title="EL PRÓXIMO PASO ES TUYO." linkLabel="Explorá el calzado" />
      <CollectionFilters filters={footwearFilters} disclosure="Diseños propios SPOT · Selección conceptual" />
      <ProductGrid products={footwearProducts} />
    </ContentSection>
  );
};

export default FootwearSection;
