import { STORES, type Category, type Gender, type Offer, type Sport, type StoreId } from '../../shared/precios';
import { chunks, decode, money, pick, text } from './html';
import { cleanName, codeFromDexterPid, codeFromMagentoImage, codeFromMagentoUrl, type CleanName } from './names';

/** Un producto leído del listado de una tienda, antes de cruzarlo con las otras. */
export type Listing = {
  offer: Offer;
  code: string | null;
  clean: CleanName;
  category: Category;
  type: string;
  sports: Sport[];
};

export type FetchPage = (url: string) => Promise<string>;

/** Una categoría pública del menú de la tienda que listamos entera. */
export type Section = { path: string; genders: Gender[]; category: Category; type?: string; sports?: Sport[]; defaultSports?: Sport[] };
/** Una subcategoría por deporte: sólo la usamos para saber de qué deporte es cada producto. */
type Tag = { path: string; sport: Sport };

const each = (prefixes: string[], path: string, genders: Gender[][]) => prefixes.map((prefix, index) => ({ path: `/${prefix}${path}`, genders: genders[index] }));
const H: Gender[] = ['Hombre'];
const M: Gender[] = ['Mujer'];
const N: Gender[] = ['Niños'];

const CONFIG: Record<StoreId, { sections: Section[]; tags: Tag[] }> = {
  opensports: {
    sections: [
      ...each(['hombre', 'mujer', 'ninos'], '/zapatillas.html', [H, M, N]).map((section) => ({ ...section, category: 'calzado' as const, type: 'Zapatillas' })),
      ...each(['hombre', 'mujer', 'ninos'], '/botines.html', [H, M, N]).map((section) => ({ ...section, category: 'calzado' as const, type: 'Botines', sports: ['Fútbol' as const] })),
      ...each(['hombre', 'mujer', 'ninos'], '/indumentaria.html', [H, M, N]).map((section) => ({ ...section, category: 'indumentaria' as const })),
      ...each(['hombre', 'mujer', 'ninos'], '/accesorios.html', [H, M, N]).map((section) => ({ ...section, category: 'accesorios' as const })),
    ],
    tags: [
      ...['hombre', 'mujer'].map((who) => ({ path: `/${who}/zapatillas/running.html`, sport: 'Running' as const })),
      ...['hombre', 'mujer'].map((who) => ({ path: `/${who}/zapatillas/training.html`, sport: 'Training' as const })),
      ...['hombre', 'mujer', 'ninos'].map((who) => ({ path: `/${who}/zapatillas/moda.html`, sport: 'Urbana' as const })),
      ...['hombre', 'mujer'].map((who) => ({ path: `/${who}/zapatillas/tenis.html`, sport: 'Tenis y pádel' as const })),
      ...['hombre', 'mujer'].map((who) => ({ path: `/${who}/zapatillas/outdoor.html`, sport: 'Outdoor' as const })),
      { path: '/hombre/zapatillas/basquet.html', sport: 'Básquet' },
      ...['hombre', 'mujer', 'ninos'].map((who) => ({ path: `/${who}/indumentaria/indumentaria-futbol.html`, sport: 'Fútbol' as const })),
    ],
  },
  // Trip Store es una tienda urbana: si el nombre no dice otro deporte, es Urbana.
  trip: {
    sections: [
      ...each(['hombre', 'mujer', 'young'], '/zapatillas.html', [H, M, N]).map((section) => ({ ...section, category: 'calzado' as const, type: 'Zapatillas', defaultSports: ['Urbana' as const] })),
      ...each(['hombre', 'mujer', 'young'], '/indumentaria.html', [H, M, N]).map((section) => ({ ...section, category: 'indumentaria' as const, defaultSports: ['Urbana' as const] })),
      ...each(['hombre', 'mujer', 'young'], '/accesorios.html', [H, M, N]).map((section) => ({ ...section, category: 'accesorios' as const, defaultSports: ['Urbana' as const] })),
    ],
    tags: [],
  },
  dexter: {
    sections: [
      ...each(['hombre', 'mujer'], '/calzado/zapatillas', [H, M]).map((section) => ({ ...section, category: 'calzado' as const, type: 'Zapatillas' })),
      ...each(['hombre', 'mujer'], '/calzado/botines', [H, M]).map((section) => ({ ...section, category: 'calzado' as const, type: 'Botines', sports: ['Fútbol' as const] })),
      ...each(['hombre', 'mujer'], '/indumentaria', [H, M]).map((section) => ({ ...section, category: 'indumentaria' as const })),
      ...each(['hombre', 'mujer'], '/accesorios', [H, M]).map((section) => ({ ...section, category: 'accesorios' as const })),
    ],
    tags: [
      { path: '/categorias/running', sport: 'Running' },
      { path: '/categorias/training', sport: 'Training' },
      { path: '/categorias/futbol', sport: 'Fútbol' },
      { path: '/categorias/moda', sport: 'Urbana' },
      { path: '/categorias/basquet', sport: 'Básquet' },
      { path: '/categorias/outdoor', sport: 'Outdoor' },
    ],
  },
};

const FALLBACK_TYPE: Record<Category, string> = { calzado: 'Zapatillas', indumentaria: 'Otras prendas', accesorios: 'Otros accesorios' };

/** Categoría, tipo y deportes de un producto según el nombre y la sección donde apareció. */
function classify(clean: CleanName, section: Section): Pick<Listing, 'category' | 'type' | 'sports'> {
  const category = clean.category ?? section.category;
  const sports = uniq([...(section.sports ?? []), ...clean.sports]);
  return { category, type: clean.type ?? section.type ?? FALLBACK_TYPE[category], sports: sports.length ? sports : [...(section.defaultSports ?? [])] };
}

const MAGENTO_PAGE_SIZE = 36; // El máximo que ofrecen Open Sports y Trip en "por página".
const DEXTER_PAGE_SIZE = 120;
const MAX_PAGES = 80;

const absolute = (store: StoreId, url: string) => (url.startsWith('http') ? url : `${STORES[store].site}${url}`);
const tidyInstallments = (value: string | null) => (value ? text(value).replace(/\$\s+/g, '$').replace(/,00\b/g, '') || null : null);
const uniq = <T,>(list: T[]) => [...new Set(list)];

// ---------- Open Sports y Trip Store (Magento 2, mismo tema) ----------

/** La foto sin el "/cache/<hash>/" de Magento es la original en alta resolución. */
const magentoOriginal = (url: string) => url.replace(/\/cache\/[0-9a-f]{32}\//, '/');

export function parseMagentoPage(html: string, store: StoreId, section: Section): { items: Listing[]; total: number | null } {
  const numbers = [...html.matchAll(/toolbar-number">(\d+)/g)].map((match) => Number(match[1]));
  const total = numbers.length ? Math.max(...numbers) : null;
  const items: Listing[] = [];

  // El último pedazo arrastra el resto de la página: lo cortamos donde termina la grilla.
  for (const chunk of chunks(html, '<li class="item product product-item">').map((part) => part.split('</ol>')[0])) {
    const id = pick(chunk, /product-item-info_(\d+)/);
    const url = pick(chunk, /class="product-item-link"\s+href="([^"]+)"/);
    const title = text(pick(chunk, /class="product-item-link"\s+href="[^"]+">([\s\S]*?)<\/a>/) ?? '');
    const price = money(pick(chunk, /data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"/));
    if (!id || !url || !title || !price || /stock unavailable|out-of-stock/.test(chunk)) continue;

    const listPrice = money(pick(chunk, /data-price-amount="([\d.]+)"\s+data-price-type="oldPrice"/));
    const mainTag = pick(chunk, /(<img class="product-image-photo"[^>]*>)/) ?? '';
    const main = pick(mainTag, /\ssrc="([^"]+)"/);
    const thumb = pick(mainTag, /(https?:\/\/\S+)\s+480w/) ?? main;
    const hover = pick(chunk, /<img class="hover-image product-image-photo"[^>]*?\ssrc="([^"]+)"/);
    const clean = cleanName(title);

    items.push({
      code: (main && codeFromMagentoImage(main)) ?? codeFromMagentoUrl(url),
      clean,
      ...classify(clean, section),
      offer: {
        store,
        storeProductId: id,
        url: decode(url),
        title,
        price,
        listPrice: listPrice && listPrice > price ? listPrice : null,
        installments: tidyInstallments(pick(chunk, /<div class="installments-price">([\s\S]*?)<\/div>/)),
        thumb: decode(thumb ?? ''),
        images: uniq([main, hover].filter((image): image is string => !!image).map((image) => magentoOriginal(decode(image)))),
        genders: uniq([...section.genders, ...clean.genders]),
      },
    });
  }
  return { items, total };
}

async function crawlMagentoSection(store: StoreId, section: Section, fetchPage: FetchPage): Promise<Listing[]> {
  const found: Listing[] = [];
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
    const html = await fetchPage(`${STORES[store].site}${section.path}?product_list_limit=${MAGENTO_PAGE_SIZE}&p=${page}`);
    const { items, total } = parseMagentoPage(html, store, section);
    if (page === 1 && total) pages = Math.ceil(total / MAGENTO_PAGE_SIZE);
    if (!items.length) break;
    found.push(...items);
  }
  return found;
}

// ---------- Dexter (Salesforce Commerce Cloud) ----------

const dexterImage = (url: string, size: number) => decode(url).replace(/\?.*$/, `?sw=${size}&sh=${size}`);

export function parseDexterPage(html: string, section: Section): Listing[] {
  const items: Listing[] = [];
  for (const chunk of chunks(html, '<div class="product" data-pid="')) {
    const pid = pick(chunk, /data-pid="([^"]+)"/);
    const url = pick(chunk, /<div class="pdp-link">\s*<a class="link" href="([^"]+)"/);
    const title = text(pick(chunk, /<div class="pdp-link">\s*<a class="link"[^>]*>([\s\S]*?)<\/a>/) ?? '');
    const price = money(pick(chunk, /class="sales">\s*<span class="value" content="([\d.]+)"/));
    if (!pid || !url || !title || !price) continue;

    const listPrice = money(pick(chunk, /strike-through list">\s*<span class="value" content="([\d.]+)"/));
    const main = pick(chunk, /tile-image primary-image"\s+src="([^"]+)"/);
    const second = pick(chunk, /tile-image second-image"\s+src="([^"]+)"/);
    const clean = cleanName(title);

    items.push({
      code: codeFromDexterPid(pid),
      clean,
      ...classify(clean, section),
      offer: {
        store: 'dexter',
        storeProductId: pid,
        url: absolute('dexter', decode(url)),
        title,
        price,
        listPrice: listPrice && listPrice > price ? listPrice : null,
        installments: tidyInstallments(pick(chunk, /<div class="installments-container[^"]*">([\s\S]*?)<\/div>\s*<\/a>/)),
        thumb: main ? dexterImage(main, 480) : '',
        images: [main, second].filter((image): image is string => !!image).map((image) => dexterImage(image, 1000)),
        genders: uniq([...section.genders, ...clean.genders]),
      },
    });
  }
  return items;
}

async function crawlDexterSection(section: Section, fetchPage: FetchPage): Promise<Listing[]> {
  const found: Listing[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const html = await fetchPage(`${STORES.dexter.site}${section.path}?start=${page * DEXTER_PAGE_SIZE}&sz=${DEXTER_PAGE_SIZE}`);
    const items = parseDexterPage(html, section).filter((item) => !seen.has(item.offer.storeProductId));
    items.forEach((item) => seen.add(item.offer.storeProductId));
    found.push(...items);
    if (items.length < DEXTER_PAGE_SIZE) break;
  }
  return found;
}

const crawlSection = (store: StoreId, section: Section, fetchPage: FetchPage) => (store === 'dexter' ? crawlDexterSection(section, fetchPage) : crawlMagentoSection(store, section, fetchPage));

/**
 * Lee todas las secciones de una tienda (de a una página por vez) y después sus subcategorías
 * por deporte, para marcar cada producto con su deporte. `onProgress` recibe lo leído hasta el momento.
 */
export async function crawlStore(store: StoreId, fetchPage: FetchPage, onProgress?: (listings: Listing[]) => void): Promise<Listing[]> {
  const { sections, tags } = CONFIG[store];
  const found: Listing[] = [];
  for (const section of sections) {
    found.push(...(await crawlSection(store, section, fetchPage)));
    onProgress?.(found);
  }

  const sportsById = new Map<string, Set<Sport>>();
  for (const tag of tags) {
    // Una subcategoría que falla no invalida el resto: sólo nos quedamos sin esa etiqueta.
    const tagged = await crawlSection(store, { path: tag.path, genders: [], category: 'calzado' }, fetchPage).catch(() => []);
    for (const item of tagged) {
      const set = sportsById.get(item.offer.storeProductId) ?? new Set<Sport>();
      set.add(tag.sport);
      sportsById.set(item.offer.storeProductId, set);
    }
  }
  for (const listing of found) {
    const extra = sportsById.get(listing.offer.storeProductId);
    if (extra) listing.sports = uniq([...listing.sports, ...extra]);
  }
  return found;
}
