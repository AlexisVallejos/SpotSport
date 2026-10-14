import { preciosLink } from '../lib/precios';

// Cada fila lleva al comparador con el filtro de entrenamiento ya puesto.
export const trainingCategories = [
  { label: 'Calzado de entrenamiento', href: preciosLink({ category: 'calzado', sport: 'Training' }) },
  { label: 'Indumentaria técnica', href: preciosLink({ category: 'indumentaria', sport: 'Training' }) },
  { label: 'Accesorios para tu rutina', href: preciosLink({ category: 'accesorios', sport: 'Training' }) },
];
