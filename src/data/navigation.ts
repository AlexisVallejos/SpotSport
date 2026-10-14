// Rutas internas (/precios…) navegan con el router; los "#" son secciones de la landing.
export const departments = [
  { label: 'Precios', href: '/precios' },
  { label: 'Novedades', href: '/precios?orden=nuevos' },
  { label: 'Calzado', href: '#calzado' },
  { label: 'Indumentaria', href: '#indumentaria' },
  { label: 'Deportes', href: '#deportes' },
];

export const searchPlaceholder = '¿Qué estás buscando?';
