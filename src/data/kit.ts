import type { SearchQuery } from '../lib/precios';

// El equipo de running de "El estudio SPOT": para cada lugar, el producto real más conveniente del comparador.
export const kitSlots: { label: string; query: SearchQuery }[] = [
  { label: 'Calzado de running', query: { category: 'calzado', sport: 'Running' } },
  { label: 'Remera de running', query: { category: 'indumentaria', sport: 'Running', type: 'Remera' } },
  { label: 'Accesorio de running', query: { category: 'accesorios', sport: 'Running' } },
];
