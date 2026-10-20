import { CATEGORIES, GENDERS, SALE_MIN_DISCOUNT, SORTS, SPORTS, STORES, type Category, type Facet, type Gender, type Product, type ProductSummary, type SearchQuery, type SearchResult, type SortKey, type Sport, type StoreId } from '../../shared/precios';

const MAX_LIMIT = 96;
const MAX_FACETS = 40;

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function summarize({ images: _images, offers, ...product }: Product): ProductSummary {
  return { ...product, offers: offers.map(({ store, url, price, listPrice, installments }) => ({ store, url, price, listPrice, installments })) };
}

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  // Primero lo que se puede comparar, después lo que más ahorra, después lo más rebajado.
  recomendado: (a, b) => Math.min(b.offers.length, 2) - Math.min(a.offers.length, 2) || b.savings - a.savings || b.discount - a.discount,
  ahorro: (a, b) => b.savings - a.savings || a.best - b.best,
  descuento: (a, b) => b.discount - a.discount || a.best - b.best,
  menor: (a, b) => a.best - b.best,
  mayor: (a, b) => b.best - a.best,
  nuevos: (a, b) => (b.firstSeen ?? '').localeCompare(a.firstSeen ?? '') || SORTERS.recomendado(a, b),
};

const oneOf = <T extends string>(value: string | null, options: readonly T[]): T | null => (value && (options as readonly string[]).includes(value) ? (value as T) : null);

/** Lee los filtros de la URL (?q=&categoria=&deporte=…) y descarta lo que no es válido. */
export function parseQuery(params: URLSearchParams): SearchQuery {
  const number = (key: string, fallback: number) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  };
  const ids = params.get('ids');
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    category: oneOf<Category>(params.get('categoria'), Object.keys(CATEGORIES) as Category[]),
    type: params.get('tipo')?.slice(0, 40) || null,
    sport: oneOf<Sport>(params.get('deporte'), SPORTS),
    gender: oneOf<Gender>(params.get('genero'), GENDERS),
    brand: params.get('marca')?.slice(0, 40) || null,
    store: oneOf<StoreId>(params.get('tienda'), Object.keys(STORES) as StoreId[]),
    compared: params.get('comparables') === '1',
    onSale: params.get('oferta') === '1',
    ids: ids ? ids.split(',').filter(Boolean).slice(0, 200) : null,
    sort: oneOf<SortKey>(params.get('orden'), SORTS.map((sort) => sort.key)) ?? 'recomendado',
    offset: number('desde', 0),
    limit: Math.min(number('limite', 48) || 48, MAX_LIMIT),
  };
}

type Filter = keyof Pick<SearchQuery, 'q' | 'category' | 'type' | 'sport' | 'gender' | 'brand' | 'store' | 'compared' | 'onSale' | 'ids'>;

function matcher(query: SearchQuery, skip?: Filter) {
  const words = fold(query.q ?? '').split(/\s+/).filter(Boolean);
  const ids = query.ids ? new Set(query.ids) : null;
  return (product: Product) => {
    if (ids && skip !== 'ids' && !ids.has(product.id)) return false;
    if (query.category && skip !== 'category' && product.category !== query.category) return false;
    if (query.type && skip !== 'type' && product.type !== query.type) return false;
    if (query.sport && skip !== 'sport' && !product.sports.includes(query.sport)) return false;
    if (query.gender && skip !== 'gender' && !product.genders.includes(query.gender)) return false;
    if (query.brand && skip !== 'brand' && product.brand !== query.brand) return false;
    if (query.store && skip !== 'store' && !product.offers.some((offer) => offer.store === query.store)) return false;
    if (query.compared && skip !== 'compared' && product.offers.length < 2) return false;
    if (query.onSale && skip !== 'onSale' && product.discount < SALE_MIN_DISCOUNT) return false;
    if (!words.length || skip === 'q') return true;
    const haystack = fold(`${product.name} ${product.type} ${product.sports.join(' ')} ${product.id}`);
    return words.every((word) => haystack.includes(word));
  };
}

function facet(products: Product[], key: (product: Product) => string): Facet[] {
  const counts = new Map<string, number>();
  for (const product of products) counts.set(key(product), (counts.get(key(product)) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, MAX_FACETS);
}

/** Filtra, ordena y pagina. Cada lista de opciones (marcas, tipos) se cuenta sin su propio filtro, para poder cambiarlo. */
export function search(products: Product[], query: SearchQuery): SearchResult {
  const matches = products.filter(matcher(query)).sort(SORTERS[query.sort ?? 'recomendado']);
  const offset = query.offset ?? 0;
  return {
    total: matches.length,
    items: matches.slice(offset, offset + (query.limit ?? 48)).map(summarize),
    brands: facet(products.filter(matcher(query, 'brand')), (product) => product.brand),
    types: facet(products.filter(matcher(query, 'type')), (product) => product.type),
  };
}
