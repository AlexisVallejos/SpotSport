import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES, STORES, type CatalogStatus, type Category, type Product, type ProductDetail, type Review, type SearchQuery, type SearchResult, type StoreId, type StoreReviews } from '../../shared/precios';
import { buildProducts } from './match';
import { fetchStoreReviews, validateReview } from './reviews';
import { search, summarize } from './search';
import { crawlStore, type FetchPage, type Listing } from './stores';

const STORE_IDS = Object.keys(STORES) as StoreId[];
const HISTORY_POINTS = 120;
const HISTORY_FORGET_DAYS = 90;
const REVIEWS_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_LISTINGS = 20; // Menos que esto es una página rota, no un catálogo: conservamos el anterior.
// Cambia cuando cambia la forma de lo guardado: un archivo de otra versión se ignora y se vuelve a leer todo.
const STORES_FILE = 'tiendas-v2.json';

type StoreState = { listings: Listing[]; updatedAt: string | null; error: string | null };

export type PriceServiceOptions = {
  dataDir: string;
  refreshHours: number;
  /** Pausa entre páginas de una misma tienda, para no cargarle el sitio. */
  delayMs: number;
  userAgent: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Un pedido por vez y con pausa entre uno y otro; reintenta dos veces si la tienda falla. */
export function politeFetcher({ delayMs, userAgent, fetchImpl = fetch }: Pick<PriceServiceOptions, 'delayMs' | 'userAgent' | 'fetchImpl'>): FetchPage {
  let queue = Promise.resolve();
  let last = 0;
  return (url) => {
    const run = queue.then(async () => {
      const wait = last + delayMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const response = await fetchImpl(url, {
              headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-AR,es;q=0.9' },
              signal: AbortSignal.timeout(45_000),
            });
            if (response.ok) return await response.text();
            if (response.status === 404 || attempt >= 2) throw new Error(`${new URL(url).hostname} respondió ${response.status}`);
          } catch (error) {
            if (attempt >= 2 || message(error).includes('respondió 404')) throw error;
          }
          await sleep(5_000 * (attempt + 1));
        }
      } finally {
        last = Date.now();
      }
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}

export class PriceService {
  private stores = Object.fromEntries(STORE_IDS.map((id): [StoreId, StoreState] => [id, { listings: [], updatedAt: null, error: null }])) as Record<StoreId, StoreState>;
  private products: Product[] = [];
  private byId = new Map<string, Product>();
  private history: Record<string, [string, number][]> = {};
  private community: Record<string, Review[]> = {};
  private reviewCache = new Map<string, { at: number; value: StoreReviews }>();
  private refreshing = false;
  private lastRefresh = 0;
  private updatedAt: string | null = null;
  /** El estado ya serializado: se arma una vez por actualización y se sirve tal cual. */
  statusJson = '';

  constructor(private options: PriceServiceOptions) {
    this.rebuild();
  }

  private file = (name: string) => path.join(this.options.dataDir, name);
  private log = (text: string) => (this.options.log ?? console.log)(`[precios] ${text}`);

  async start() {
    await mkdir(this.options.dataDir, { recursive: true });
    this.stores = { ...this.stores, ...(await readJson<Partial<Record<StoreId, StoreState>>>(this.file(STORES_FILE), {})) };
    this.history = await readJson(this.file('historial.json'), {});
    this.community = await readJson(this.file('resenas.json'), {});
    this.updatedAt = STORE_IDS.map((id) => this.stores[id].updatedAt).filter(Boolean).sort()[0] ?? null;
    this.rebuild();

    const everyMs = this.options.refreshHours * 60 * 60 * 1000;
    this.lastRefresh = Math.min(...STORE_IDS.map((id) => Date.parse(this.stores[id].updatedAt ?? '') || 0));
    const tick = () => {
      if (Date.now() - this.lastRefresh >= everyMs) void this.refresh();
    };
    tick();
    setInterval(tick, Math.min(everyMs, 10 * 60 * 1000)).unref();
  }

  /** Vuelve a leer las tres tiendas en paralelo (cada una despacio). Mientras tanto se sigue sirviendo lo anterior. */
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.lastRefresh = Date.now();
    this.rebuild();
    this.log('actualizando precios…');
    await Promise.all(
      STORE_IDS.map(async (id) => {
        const started = Date.now();
        // La primera vez no hay nada que mostrar: vamos publicando cada sección que termina.
        const firstTime = this.stores[id].listings.length === 0;
        const onProgress = (partial: Listing[]) => {
          if (!firstTime) return;
          this.stores[id] = { ...this.stores[id], listings: [...partial] };
          this.rebuild();
        };
        try {
          const listings = await crawlStore(id, politeFetcher(this.options), onProgress);
          if (listings.length < MIN_LISTINGS) throw new Error(`sólo ${listings.length} productos`);
          this.stores[id] = { listings, updatedAt: new Date().toISOString(), error: null };
          this.log(`${STORES[id].name}: ${listings.length} productos en ${Math.round((Date.now() - started) / 1000)} s`);
        } catch (error) {
          this.stores[id] = { ...this.stores[id], error: message(error) };
          this.log(`${STORES[id].name}: falló (${message(error)}), quedan los precios anteriores`);
        }
        this.rebuild(); // Cada tienda que termina ya se ve, sin esperar a las otras.
      }),
    );
    this.updatedAt = new Date().toISOString();
    this.refreshing = false;
    this.recordHistory();
    this.rebuild();
    this.reviewCache.clear();
    await writeJson(this.file(STORES_FILE), this.stores);
    await writeJson(this.file('historial.json'), this.history);
    this.log(`listo: ${this.products.length} productos`);
  }

  private rebuild() {
    this.products = buildProducts(
      STORE_IDS.flatMap((id) => this.stores[id].listings),
      (id) => this.history[id]?.[0]?.[0] ?? null,
    );
    this.byId = new Map(this.products.map((product) => [product.id, product]));
    const byCategory = Object.fromEntries((Object.keys(CATEGORIES) as Category[]).map((category) => [category, 0])) as Record<Category, number>;
    for (const product of this.products) byCategory[product.category]++;
    const status: CatalogStatus = {
      updatedAt: this.updatedAt,
      refreshing: this.refreshing,
      stores: Object.fromEntries(
        STORE_IDS.map((id) => [id, { name: STORES[id].name, count: this.stores[id].listings.length, updatedAt: this.stores[id].updatedAt, error: this.stores[id].error }]),
      ) as CatalogStatus['stores'],
      total: this.products.length,
      compared: this.products.filter((product) => product.offers.length > 1).length,
      byCategory,
    };
    this.statusJson = JSON.stringify(status);
  }

  private recordHistory() {
    const day = today();
    for (const product of this.products) {
      const points = (this.history[product.id] ??= []);
      const last = points[points.length - 1];
      if (last?.[0] === day) last[1] = product.best;
      else points.push([day, product.best]);
      if (points.length > HISTORY_POINTS) points.splice(0, points.length - HISTORY_POINTS);
    }
    const forget = new Date(Date.now() - HISTORY_FORGET_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const [id, points] of Object.entries(this.history)) {
      if (!this.byId.has(id) && (points[points.length - 1]?.[0] ?? '') < forget) delete this.history[id];
    }
  }

  has(id: string) {
    return this.byId.has(id);
  }

  search(query: SearchQuery): SearchResult {
    return search(this.products, query);
  }

  detail(id: string): ProductDetail | null {
    const product = this.byId.get(id);
    if (!product) return null;
    return { product: summarize(product), images: product.images, history: this.history[id] ?? [], reviews: [...(this.community[id] ?? [])].reverse() };
  }

  /** Reseñas publicadas en las fichas de las tiendas. Tardan unos segundos: se guardan 12 horas. */
  async storeReviews(id: string): Promise<StoreReviews | null> {
    const product = this.byId.get(id);
    if (!product) return null;
    const cached = this.reviewCache.get(id);
    if (cached && Date.now() - cached.at < REVIEWS_TTL_MS) return cached.value;
    const fetchPage = politeFetcher({ ...this.options, delayMs: 0 });
    const results = await Promise.allSettled(product.offers.map((offer) => fetchStoreReviews(offer.store, offer.storeProductId, fetchPage)));
    const value: StoreReviews = {
      reviews: results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      errors: product.offers.filter((_, index) => results[index].status === 'rejected').map((offer) => offer.store),
    };
    this.reviewCache.set(id, { at: Date.now(), value });
    return value;
  }

  async addReview(id: string, input: unknown): Promise<Review | string> {
    if (!this.byId.has(id)) return 'No encontramos ese producto.';
    const valid = validateReview(input);
    if (typeof valid === 'string') return valid;
    const review: Review = { source: 'spot', author: valid.author, title: null, text: valid.text, rating: valid.rating, date: new Date().toISOString() };
    (this.community[id] ??= []).push(review);
    await writeJson(this.file('resenas.json'), this.community);
    return review;
  }
}
