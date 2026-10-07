import { FunctionComponent, useState } from 'react';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import CollectionFilters from '../CollectionFilters/CollectionFilters';
import ProductGrid from '../ProductGrid/ProductGrid';
import { FootwearFilterKey, footwearFilters, footwearProducts } from '../../../data/products';

const FootwearSection: FunctionComponent = () => {
  const [selected, setSelected] = useState<FootwearFilterKey>('all');

  const products = footwearProducts
    .filter((product) => selected === 'all' || product.sport === selected)
    .map(({ sport, ...card }) => card);

  const filters = footwearFilters.map(({ key, label }) => ({
    label,
    active: key === selected,
    onSelect: () => setSelected(key),
  }));

  return (
    <ContentSection tone="white" id="calzado" labelledBy="calzado-titulo">
      <SectionHeading id="calzado-titulo" marker="NUEVAS SILUETAS" title="EL PRÓXIMO PASO ES TUYO." linkLabel="Explorá el calzado" />
      <CollectionFilters filters={filters} disclosure="Diseños propios SPOT · Selección conceptual" />
      <ProductGrid products={products} />
    </ContentSection>
  );
};

export default FootwearSection;
