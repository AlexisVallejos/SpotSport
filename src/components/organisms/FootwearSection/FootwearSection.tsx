import { FunctionComponent, useEffect, useState } from 'react';
import { useHashRoute } from '../../../lib/hashRoute';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import CollectionFilters from '../CollectionFilters/CollectionFilters';
import PriceShowcase from '../PriceShowcase/PriceShowcase';
import { FootwearFilterKey, footwearFilters } from '../../../data/products';
import { preciosLink, type Sport } from '../../../lib/precios';

// Cada filtro de la landing es un deporte del comparador.
const SPORT: Record<FootwearFilterKey, Sport | null> = { all: null, running: 'Running', training: 'Training', football: 'Fútbol', sportstyle: 'Urbana' };

// Mismo formato que "Vestite de lo que te mueve": título, filtros y grilla de cartas con precios reales.
const FootwearSection: FunctionComponent = () => {
  const [selected, setSelected] = useState<FootwearFilterKey>('all');
  const route = useHashRoute();
  useEffect(() => {
    if (!route.startsWith('calzado')) return;
    const discipline = route.split('/')[1];
    const filter = footwearFilters.find(({ key }) => key === discipline)?.key ?? 'all';
    setSelected(filter);
    if (discipline) document.getElementById('calzado')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [route]);

  const query = { category: 'calzado' as const, sport: SPORT[selected] };

  const filters = footwearFilters.map(({ key, label }) => ({
    label,
    active: key === selected,
    onSelect: () => { setSelected(key); window.location.hash = key === 'all' ? 'calzado' : `calzado/${key}`; },
  }));

  return (
    <ContentSection tone="muted" id="calzado" labelledBy="calzado-titulo">
      <SectionHeading id="calzado-titulo" marker="AL MEJOR PRECIO" title="ELEGÍ TU TERRENO." linkLabel="Explorá el calzado" linkHref={preciosLink(query)} />
      <CollectionFilters filters={filters} disclosure="Precios reales de Open Sports, Dexter y Trip Store" />
      <PriceShowcase query={query} limit={4} />
    </ContentSection>
  );
};

export default FootwearSection;
