// Tipos compartidos entre la API de precios (server/) y la web (src/).

export type StoreId = 'opensports' | 'trip' | 'dexter';

export type Gender = 'Hombre' | 'Mujer' | 'Niños';

export type Category = 'calzado' | 'indumentaria' | 'accesorios';

export type Sport = 'Running' | 'Training' | 'Fútbol' | 'Urbana' | 'Básquet' | 'Tenis y pádel' | 'Outdoor';

export const STORES: Record<StoreId, { name: string; site: string }> = {
  opensports: { name: 'Open Sports', site: 'https://www.opensports.com.ar' },
  trip: { name: 'Trip Store', site: 'https://www.tripstore.com.ar' },
  dexter: { name: 'Dexter', site: 'https://www.dexter.com.ar' },
};

export const CATEGORIES: Record<Category, string> = { calzado: 'Calzado', indumentaria: 'Indumentaria', accesorios: 'Accesorios' };

export const SPORTS: Sport[] = ['Running', 'Training', 'Fútbol', 'Urbana', 'Básquet', 'Tenis y pádel', 'Outdoor'];

export const GENDERS: Gender[] = ['Hombre', 'Mujer', 'Niños'];

/** Lo que una tienda cobra por un producto, tal como figura en su listado. */
export type Offer = {
  store: StoreId;
  /** Id del producto dentro de la tienda (para pedirle reseñas). */
  storeProductId: string;
  url: string;
  /** Nombre tal cual lo publica la tienda. */
  title: string;
  price: number;
  /** Precio antes del descuento, si la tienda muestra uno. */
  listPrice: number | null;
  /** "12 cuotas de $21.667", "2 cuotas sin interés de $27.500"… */
  installments: string | null;
  /** Foto chica para la carta. */
  thumb: string;
  /** Fotos grandes para el panel. */
  images: string[];
  genders: Gender[];
};

export type Product = {
  /** Código de modelo del fabricante en minúsculas (ej. "jr1912", "ih1698001"). */
  id: string;
  /** Nombre entendible: "adidas Samba OG", "Remera Nike Dri-FIT Miler". */
  name: string;
  brand: string;
  /** Para el título de la carta, sin la marca: "Samba OG", "Remera Dri-FIT Miler". */
  title: string;
  category: Category;
  /** Zapatillas, Botines, Remera, Buzo, Gorra… */
  type: string;
  sports: Sport[];
  genders: Gender[];
  thumb: string;
  images: string[];
  /** Ordenadas de la más barata a la más cara. */
  offers: Offer[];
  best: number;
  worst: number;
  /** Diferencia entre la tienda más cara y la más barata. */
  savings: number;
  /** Descuento de la mejor oferta sobre su propio precio de lista (0–100). */
  discount: number;
  /** Primer día (AAAA-MM-DD) en que lo vimos publicado. */
  firstSeen: string | null;
};

/** Lo justo para la carta y la tabla de precios. */
export type OfferSummary = Pick<Offer, 'store' | 'url' | 'price' | 'listPrice' | 'installments'>;
export type ProductSummary = Omit<Product, 'images' | 'offers'> & { offers: OfferSummary[] };

export type StoreStatus = {
  name: string;
  count: number;
  updatedAt: string | null;
  error: string | null;
};

export type CatalogStatus = {
  /** Cuándo terminó el último barrido completo. Null mientras corre el primero. */
  updatedAt: string | null;
  refreshing: boolean;
  stores: Record<StoreId, StoreStatus>;
  total: number;
  /** Productos que vende más de una tienda. */
  compared: number;
  byCategory: Record<Category, number>;
};

/** Desde cuánto descuento un producto cuenta como oferta (la misma marca "-N%" de las cartas). */
export const SALE_MIN_DISCOUNT = 5;

export type SortKey = 'recomendado' | 'ahorro' | 'descuento' | 'menor' | 'mayor' | 'nuevos';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recomendado', label: 'Recomendado' },
  { key: 'ahorro', label: 'Mayor ahorro entre tiendas' },
  { key: 'descuento', label: 'Mayor descuento' },
  { key: 'menor', label: 'Menor precio' },
  { key: 'mayor', label: 'Mayor precio' },
  { key: 'nuevos', label: 'Recién llegados' },
];

export type SearchQuery = {
  q?: string;
  category?: Category | null;
  type?: string | null;
  sport?: Sport | null;
  gender?: Gender | null;
  brand?: string | null;
  store?: StoreId | null;
  /** Sólo productos que vende más de una tienda. */
  compared?: boolean;
  /** Sólo lo que está rebajado (5 % o más sobre el precio de lista de la tienda). */
  onSale?: boolean;
  /** Sólo estos ids (favoritos). */
  ids?: string[] | null;
  sort?: SortKey;
  offset?: number;
  limit?: number;
};

export type Facet = { value: string; count: number };

export type SearchResult = {
  total: number;
  items: ProductSummary[];
  brands: Facet[];
  types: Facet[];
};

export type Review = {
  source: StoreId | 'spot';
  author: string;
  title: string | null;
  text: string;
  /** 1–5 estrellas. */
  rating: number | null;
  date: string | null;
};

export type ProductDetail = {
  product: ProductSummary;
  /** Fotos grandes de todas las tiendas que lo venden. */
  images: string[];
  /** [fecha AAAA-MM-DD, mejor precio ese día], del más viejo al más nuevo. */
  history: [string, number][];
  /** Reseñas dejadas en SPOT (las de las tiendas se piden aparte: tardan más). */
  reviews: Review[];
};

export type StoreReviews = {
  reviews: Review[];
  /** Tiendas que no pudimos consultar. */
  errors: StoreId[];
};
