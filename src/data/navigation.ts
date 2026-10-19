// Un solo navbar para todo el sitio. "Tienda" reúne los productos de los comercios y los de los locales
// (el comparador de precios se abre desde ahí). Las secciones de la landing van con "/#…" para funcionar desde cualquier página.
export const navLinks = [
  { label: 'Tienda', href: '/tienda' },
  { label: 'Ofertas', href: '/precios?orden=descuento' },
  { label: 'Calzado', href: '/#calzado' },
  { label: 'Indumentaria', href: '/#indumentaria' },
  { label: 'Deportes', href: '/#deportes' },
  { label: 'Entrenar', href: '/entrenar' },
];

export const searchPlaceholder = 'Buscá zapatillas, ropa, marcas…';
