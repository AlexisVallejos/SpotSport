import type { ProductCardProps } from '../components/molecules';

const collectionNote = 'Colección conceptual';

export type FootwearFilterKey = 'all' | 'running' | 'training' | 'football' | 'sportstyle';

export type FootwearProduct = ProductCardProps & { sport: Exclude<FootwearFilterKey, 'all'> };

export const footwearFilters: { key: FootwearFilterKey; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'running', label: 'Running' },
  { key: 'training', label: 'Entrenamiento' },
  { key: 'football', label: 'Fútbol' },
  { key: 'sportstyle', label: 'Sportstyle' },
];

export const footwearProducts: FootwearProduct[] = [
  {
    badge: 'NUEVO CONCEPTO',
    category: 'RUNNING / UNISEX',
    sport: 'running',
    name: 'SPOT Órbita 01',
    image: '/images/footwear-orbita-01.png',
    description: 'Malla liviana · Perfil de ruta',
    colors: ['ivory', 'orange', 'charcoal'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / UNISEX',
    sport: 'training',
    name: 'SPOT Pulso TR',
    image: '/images/footwear-pulso-tr.png',
    description: 'Base estable · Perfil de gimnasio',
    colors: ['black', 'grey'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'FÚTBOL / UNISEX',
    sport: 'football',
    name: 'SPOT Cancha 10',
    image: '/images/footwear-cancha-10.png',
    description: 'Capellada texturada · Perfil de campo',
    colors: ['orange', 'white'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'SPORTSTYLE / UNISEX',
    sport: 'sportstyle',
    name: 'SPOT Distrito',
    image: '/images/footwear-distrito.png',
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
    image: '/images/apparel-remera-aire.png',
    description: 'Corte regular · Talles XS a XXL',
    colors: ['bone', 'onyx', 'orange'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / INDUMENTARIA',
    name: 'Short Ritmo',
    image: '/images/apparel-short-ritmo.png',
    description: 'Largo medio · Talles XS a XXL',
    colors: ['onyx', 'ash'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'TRAINING / INDUMENTARIA',
    name: 'Top Eje',
    image: '/images/apparel-top-eje.png',
    description: 'Espalda deportiva · Talles XS a XL',
    colors: ['orange', 'onyx'],
    collectionNote,
  },
  {
    badge: 'SPOT / CONCEPTO',
    category: 'SPORTSTYLE / INDUMENTARIA',
    name: 'Campera Movimiento',
    image: '/images/apparel-campera-movimiento.png',
    description: 'Corte relajado · Talles S a XXL',
    colors: ['stone', 'onyx'],
    collectionNote,
  },
];
