import { CATEGORIES, GENDERS, SORTS, SPORTS, STORES, type CatalogStatus, type Category, type Gender, type ProductDetail, type Review, type SearchQuery, type SearchResult, type SortKey, type Sport, type StoreId, type StoreReviews } from '../../shared/precios';

export type { CatalogStatus, Category, Gender, ProductDetail, Review, SearchQuery, SearchResult, SortKey, Sport, StoreId, StoreReviews } from '../../shared/precios';
export type { ProductSummary as Product, OfferSummary as Offer } from '../../shared/precios';
export { CATEGORIES, GENDERS, SORTS, SPORTS, STORES } from '../../shared/precios';

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `La API de precios respondió ${response.status}.`);
  return body as T;
}

const get = <T,>(path: string, signal?: AbortSignal) => fetch(path, { signal: signal ?? AbortSignal.timeout(30_000) }).then((response) => json<T>(response));

/** Filtros ↔ parámetros de la URL (los mismos en la página /precios y en la API). */
const KEYS: Record<Exclude<keyof SearchQuery, 'compared' | 'ids' | 'offset' | 'limit'>, string> = {
  q: 'q',
  category: 'categoria',
  type: 'tipo',
  sport: 'deporte',
  gender: 'genero',
  brand: 'marca',
  store: 'tienda',
  sort: 'orden',
};

export function toParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, name] of Object.entries(KEYS) as [keyof typeof KEYS, string][]) {
    const value = query[key];
    if (value && !(key === 'sort' && value === 'recomendado')) params.set(name, String(value).trim());
  }
  if (query.compared) params.set('comparables', '1');
  if (query.ids) params.set('ids', query.ids.join(','));
  if (query.offset) params.set('desde', String(query.offset));
  if (query.limit) params.set('limite', String(query.limit));
  return params;
}

const oneOf = <T extends string>(value: string | null, options: readonly T[]): T | null => (value && (options as readonly string[]).includes(value) ? (value as T) : null);

/** Lee los filtros de la URL de la página; lo que no es válido se ignora. */
export function fromParams(params: URLSearchParams): SearchQuery {
  return {
    q: params.get('q') ?? '',
    category: oneOf<Category>(params.get('categoria'), Object.keys(CATEGORIES) as Category[]),
    type: params.get('tipo') || null,
    sport: oneOf<Sport>(params.get('deporte'), SPORTS),
    gender: oneOf<Gender>(params.get('genero'), GENDERS),
    brand: params.get('marca') || null,
    store: oneOf<StoreId>(params.get('tienda'), Object.keys(STORES) as StoreId[]),
    compared: params.get('comparables') === '1',
    sort: oneOf<SortKey>(params.get('orden'), SORTS.map((sort) => sort.key)) ?? 'recomendado',
  };
}

/** Link a la página de precios con esos filtros: preciosLink({ category: 'calzado', sport: 'Running' }). */
export const preciosLink = (query: SearchQuery = {}) => {
  const params = toParams(query).toString();
  return params ? `/precios?${params}` : '/precios';
};

export const loadStatus = () => get<CatalogStatus>('/api/precios');
export const searchProducts = (query: SearchQuery, signal?: AbortSignal) => get<SearchResult>(`/api/precios/buscar?${toParams(query)}`, signal);
export const loadDetail = (id: string) => get<ProductDetail>(`/api/precios/${encodeURIComponent(id)}`);
export const loadStoreReviews = (id: string) => get<StoreReviews>(`/api/precios/${encodeURIComponent(id)}/resenas`);

export const postReview = (id: string, review: { author: string; rating: number; text: string; website: string }) =>
  fetch(`/api/precios/${encodeURIComponent(id)}/resenas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  }).then((response) => json<Review>(response));

/** 259999 → "$259.999" (la API de precios trabaja en pesos enteros, no en centavos). */
export const formatPrice = (value: number) => `$${Math.round(value).toLocaleString('es-AR')}`;

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'todavía no';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export const genderLabel = (genders: Gender[]) => (genders.length === 0 ? '' : genders.includes('Hombre') && genders.includes('Mujer') ? 'Unisex' : genders.join(' y '));

export function averageRating(reviews: Review[]): number | null {
  const rated = reviews.filter((review) => review.rating);
  return rated.length ? rated.reduce((sum, review) => sum + (review.rating ?? 0), 0) / rated.length : null;
}
