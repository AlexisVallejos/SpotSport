import type { FooterLinkGroupProps } from '../components/molecules';

// Rutas internas (/…) navegan con el router; los "#" son secciones de la landing.
export const footerLinkGroups: FooterLinkGroupProps[] = [
  {
    title: 'EXPLORÁ',
    links: [
      { label: 'Calzado', href: '#calzado' },
      { label: 'Indumentaria', href: '#indumentaria' },
      { label: 'Accesorios', href: '/precios?categoria=accesorios' },
      { label: 'Deportes', href: '#deportes' },
    ],
  },
  {
    title: 'COMPARÁ Y COMPRÁ',
    links: [
      { label: 'Comparador de precios', href: '/precios' },
      { label: 'Ofertas en zapatillas', href: '/ofertas' },
      { label: 'Mis favoritos', href: '/precios?favoritos=1' },
      { label: 'Tienda SPOT', href: '/tienda' },
      { label: 'Mis tickets', href: '/tickets' },
    ],
  },
];

export const legalLinks = [
  { label: 'Privacidad', href: '/legal#privacidad' },
  { label: 'Términos', href: '/legal#terminos' },
];
