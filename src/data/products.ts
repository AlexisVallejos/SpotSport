import type { FilterTabProps, ProductCardProps } from '../components/molecules';

const collectionNote = 'Colección conceptual';

export const footwearFilters: FilterTabProps[] = [
  { label: 'Todo', active: true },
  { label: 'Running' },
  { label: 'Entrenamiento' },
  { label: 'Fútbol' },
  { label: 'Sportstyle' },
];

export const footwearProducts: ProductCardProps[] = [
  {
    badge: 'NUEVO CONCEPTO',
    category: 'RUNNING / UNISEX',
    name: 'SPOT Órbita 01',
    description: 'Malla liviana · Perfil de ruta',
    colors: ['ivory', 'orange', 'charcoal'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / UNISEX',
    name: 'SPOT Pulso TR',
    description: 'Base estable · Perfil de gimnasio',
    colors: ['black', 'grey'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'FÚTBOL / UNISEX',
    name: 'SPOT Cancha 10',
    description: 'Capellada texturada · Perfil de campo',
    colors: ['orange', 'white'],
    collectionNote,
    imageFit: 'narrow',
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'SPORTSTYLE / UNISEX',
    name: 'SPOT Distrito',
    description: 'Silueta urbana · Perfil de todos los días',
    colors: ['sand', 'graphite', 'steel'],
    collectionNote,
  },
];

export const apparelProducts: ProductCardProps[] = [
  {
    badge: 'SPOT / CONCEPTO',
    category: 'RUNNING / INDUMENTARIA',
    name: 'Remera Aire',
    description: 'Corte regular · Talles XS a XXL',
    colors: ['bone', 'onyx', 'orange'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / INDUMENTARIA',
    name: 'Short Ritmo',
    description: 'Largo medio · Talles XS a XXL',
    colors: ['onyx', 'ash'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / INDUMENTARIA',
    name: 'Top Eje',
    description: 'Espalda deportiva · Talles XS a XL',
    colors: ['orange', 'onyx'],
    collectionNote,
    imageFit: 'narrow',
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'SPORTSTYLE / INDUMENTARIA',
    name: 'Campera Movimiento',
    description: 'Corte relajado · Talles S a XXL',
    colors: ['stone', 'onyx'],
    collectionNote,
  },
];
