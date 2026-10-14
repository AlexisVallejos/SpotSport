import { createServer } from "node:http";
import path from "node:path";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
const STORES = {
  opensports: { name: "Open Sports", site: "https://www.opensports.com.ar" },
  trip: { name: "Trip Store", site: "https://www.tripstore.com.ar" },
  dexter: { name: "Dexter", site: "https://www.dexter.com.ar" }
};
const NAME_PREFERENCE = ["opensports", "trip", "dexter"];
const GENDER_ORDER = ["Hombre", "Mujer", "Niños"];
const MAX_IMAGES = 6;
function mergeSameStore(listings) {
  const byId = /* @__PURE__ */ new Map();
  for (const listing of listings) {
    const key = `${listing.offer.store}:${listing.offer.storeProductId}`;
    const previous = byId.get(key);
    if (!previous) {
      byId.set(key, { ...listing, offer: { ...listing.offer, genders: [...listing.offer.genders] } });
      continue;
    }
    for (const gender of listing.offer.genders) if (!previous.offer.genders.includes(gender)) previous.offer.genders.push(gender);
  }
  return [...byId.values()];
}
function buildProducts(listings) {
  const groups = /* @__PURE__ */ new Map();
  for (const listing of mergeSameStore(listings)) {
    const key = listing.code ? listing.code.toLowerCase() : `${listing.offer.store}-${listing.offer.storeProductId}`.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(listing);
    else groups.set(key, [listing]);
  }
  const products = [];
  for (const [id, group] of groups) {
    const cheapestPerStore = /* @__PURE__ */ new Map();
    for (const listing of group) {
      const current = cheapestPerStore.get(listing.offer.store);
      if (!current || listing.offer.price < current.offer.price) cheapestPerStore.set(listing.offer.store, listing);
    }
    const chosen = [...cheapestPerStore.values()];
    const offers = chosen.map((listing) => listing.offer).sort((a, b) => a.price - b.price);
    const named = NAME_PREFERENCE.map((store) => cheapestPerStore.get(store)).find(Boolean);
    const genders = GENDER_ORDER.filter((gender) => chosen.some((listing) => listing.offer.genders.includes(gender)));
    const best = offers[0];
    const worst = offers[offers.length - 1];
    products.push({
      id,
      name: named.clean.name,
      brand: named.clean.brand,
      use: chosen.map((listing) => listing.clean.use).find(Boolean) ?? null,
      genders,
      thumb: named.offer.thumb || best.thumb,
      images: [...new Set([named.offer, ...offers].flatMap((offer) => offer.images))].slice(0, MAX_IMAGES),
      offers,
      best: best.price,
      worst: worst.price,
      savings: worst.price - best.price,
      discount: best.listPrice ? Math.round((best.listPrice - best.price) / best.listPrice * 100) : 0
    });
  }
  return products;
}
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iexcl: "¡",
  iquest: "¿",
  ordm: "º",
  ordf: "ª",
  deg: "°",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  ndash: "–",
  mdash: "—"
};
function decode(text2) {
  return text2.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === "#") {
      const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return NAMED[code] ?? whole;
  });
}
function text(html) {
  return decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t\r\f\v ]+/g, " ").replace(/ *\n */g, "\n").trim();
}
function pick(html, pattern) {
  return pattern.exec(html)?.[1] ?? null;
}
function chunks(html, marker) {
  const parts = html.split(marker);
  return parts.slice(1).map((part) => marker + part);
}
function money(value) {
  if (value === null) return null;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}
function parseMagentoReviews(html, store) {
  return chunks(html, 'class="item review-item"').map((chunk) => {
    const percent = Number(pick(chunk, /rating-result"[^>]*title="(\d+)%"/) ?? pick(chunk, /itemprop="ratingValue">(\d+)%/));
    return {
      source: store,
      author: text(pick(chunk, /itemprop="author"[^>]*>([\s\S]*?)<\//) ?? "") || "Cliente",
      title: text(pick(chunk, /class="review-title"[^>]*>([\s\S]*?)<\/div>/) ?? "") || null,
      text: text(pick(chunk, /class="review-content"[^>]*>([\s\S]*?)<\/div>/) ?? ""),
      rating: percent ? Math.max(1, Math.min(5, Math.round(percent / 20))) : null,
      date: pick(chunk, /datetime="([^"]+)"/)
    };
  }).filter((review) => review.text.length > 0);
}
async function fetchStoreReviews(store, storeProductId, fetchPage) {
  if (store === "dexter") return [];
  const html = await fetchPage(`${STORES[store].site}/review/product/listAjax/id/${encodeURIComponent(storeProductId)}/`);
  return parseMagentoReviews(html, store);
}
function validateReview(input) {
  if (!input || typeof input !== "object") return "Faltan datos.";
  const { author, rating, text: body, website } = input;
  if (typeof website === "string" && website.trim()) return "No se pudo publicar.";
  const name = typeof author === "string" ? author.replace(/\s+/g, " ").trim() : "";
  const content = typeof body === "string" ? body.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : "";
  const stars = Number(rating);
  if (name.length < 2 || name.length > 40) return "Poné un nombre de 2 a 40 letras.";
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return "Elegí de 1 a 5 estrellas.";
  if (content.length < 10 || content.length > 600) return "La reseña tiene que tener entre 10 y 600 caracteres.";
  if (/https?:\/\/|www\.|\.com\b/i.test(content + name)) return "Las reseñas no pueden tener enlaces.";
  return { author: name, rating: stars, text: content };
}
const BRANDS = [
  "adidas Originals",
  "adidas Sportswear",
  "adidas",
  "New Balance",
  "Under Armour",
  "Le Coq Sportif",
  "Hi-Tec",
  "John Foos",
  "Hush Puppies",
  "On Running",
  "On",
  "DC Shoes",
  "DC",
  "Nike",
  "Jordan",
  "Puma",
  "Reebok",
  "Fila",
  "Topper",
  "ASICS",
  "Mizuno",
  "Saucony",
  "HOKA",
  "Vans",
  "Converse",
  "Skechers",
  "Merrell",
  "Salomon",
  "Columbia",
  "Kappa",
  "Umbro",
  "Joma",
  "Penalty",
  "Athix",
  "Head",
  "Wilson",
  "Babolat",
  "Lotto",
  "Crocs",
  "Timberland",
  "Lacoste",
  "Champion",
  "Montagne",
  "Olympikus",
  "Diadora",
  "Awca",
  "Element",
  "Etnies",
  "Quiksilver",
  "Kioshi",
  "Gaelle",
  "Footy",
  "Atomik",
  "Caterpillar",
  "Rusty",
  "Mormaii",
  "Brooks",
  "Altra",
  "Karhu",
  "Veja",
  "Ellesse",
  "Prince",
  "Yonex",
  "Kelme",
  "Mitre"
];
const BRAND_FAMILY = { "adidas Originals": "adidas", "adidas Sportswear": "adidas", "DC Shoes": "DC", "On Running": "On" };
const USES = [
  [/^(de\s+)?running\b/i, "Running"],
  [/^(de\s+)?trail(\s+running)?\b/i, "Trail"],
  [/^urbanas?\b/i, "Urbana"],
  [/^(de\s+)?(training|entrenamiento)\b/i, "Training"],
  [/^(de\s+)?moda\b/i, "Urbana"],
  [/^(de\s+)?(lifestyle|sportstyle)\b/i, "Urbana"],
  [/^(de\s+)?outdoor\b/i, "Outdoor"],
  [/^(de\s+)?(tenis|padel|pádel)\b/i, "Tenis y pádel"],
  [/^(de\s+)?(b[aá]squet|basket)\b/i, "Básquet"],
  [/^(de\s+)?(v[oó]ley|handball)\b/i, "Vóley y handball"],
  [/^(de\s+)?skate\b/i, "Skate"],
  [/^(de\s+)?(walking|caminata)\b/i, "Caminata"],
  [/^deportivas?\b/i, "Deportiva"]
];
const GENDER_WORDS = [
  [/\b(hombre\s+y\s+mujer|mujer\s+y\s+hombre|unisex)$/i, ["Hombre", "Mujer"]],
  [/\bhombres?$/i, ["Hombre"]],
  [/\bmujer(es)?$/i, ["Mujer"]],
  [/\b(niñ[oa]s?|nin[oa]s?|kids|junior|infantil(es)?|beb[eé]s?|young|juvenil)$/i, ["Niños"]]
];
const fold = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function tidyWord(word) {
  if (/^(i{2,3}|iv|vi{1,3}|ix)$/i.test(word)) return word.toUpperCase();
  if (/^[a-z]{1,3}\d+$/i.test(word)) return word.toUpperCase();
  if (/\d/.test(word)) return word;
  if (word.length > 3 && word === word.toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  if (word.length > 4 && word === word.toUpperCase()) return word[0] + word.slice(1).toLowerCase();
  return word;
}
function cleanName(raw) {
  let rest = raw.replace(/\s+/g, " ").trim();
  rest = rest.replace(/^zapatillas?\s+/i, "");
  let use = null;
  for (const [pattern, label] of USES) {
    if (pattern.test(rest)) {
      use = label;
      rest = rest.replace(pattern, "").trim();
      break;
    }
  }
  let genders = [];
  for (const [pattern, value] of GENDER_WORDS) {
    if (pattern.test(rest)) {
      genders = value;
      rest = rest.replace(pattern, "").trim();
      break;
    }
  }
  const folded = fold(rest);
  let brand = BRANDS.find((candidate) => folded === fold(candidate) || folded.startsWith(`${fold(candidate)} `));
  let model;
  if (brand) {
    model = rest.slice(brand.length).trim();
  } else {
    const [first, ...others] = rest.split(" ");
    brand = tidyWord(first ?? "");
    model = others.join(" ");
  }
  const trailingUse = /\s+(running|training)$/i.exec(model);
  if (trailingUse) {
    use ??= trailingUse[1][0].toUpperCase() + trailingUse[1].slice(1).toLowerCase();
    model = model.slice(0, trailingUse.index);
  }
  model = model.split(" ").filter(Boolean).map(tidyWord).join(" ");
  return { name: [brand, model].filter(Boolean).join(" "), brand: BRAND_FAMILY[brand] ?? brand, use, genders };
}
const alnum = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
function codeFromMagentoImage(url) {
  const file = url.split("?")[0].split("/").pop() ?? "";
  const stem = file.replace(/\.(jpe?g|png|webp|gif)$/i, "").split("_")[0];
  const code = alnum(stem);
  return code.length >= 5 && /\d/.test(code) ? code : null;
}
function codeFromMagentoUrl(url) {
  const slug = (url.split("?")[0].split("/").pop() ?? "").replace(/\.html$/, "");
  const tokens = slug.split("-");
  let last = tokens.pop() ?? "";
  if (/^\d{1,4}$/.test(last) && tokens.length) last = `${tokens.pop()}${last}`;
  const code = alnum(last);
  return code.length >= 5 && /\d/.test(code) ? code : null;
}
function codeFromDexterPid(pid) {
  const code = alnum(pid.slice(2));
  return code.length >= 4 ? code : null;
}
const SECTIONS = {
  opensports: [
    { path: "/hombre/zapatillas.html", genders: ["Hombre"] },
    { path: "/mujer/zapatillas.html", genders: ["Mujer"] },
    { path: "/ninos/zapatillas.html", genders: ["Niños"] }
  ],
  trip: [
    { path: "/hombre/zapatillas.html", genders: ["Hombre"] },
    { path: "/mujer/zapatillas.html", genders: ["Mujer"] },
    { path: "/young/zapatillas.html", genders: ["Niños"] }
  ],
  dexter: [
    { path: "/hombre/calzado/zapatillas", genders: ["Hombre"] },
    { path: "/mujer/calzado/zapatillas", genders: ["Mujer"] }
  ]
};
const MAGENTO_PAGE_SIZE = 36;
const DEXTER_PAGE_SIZE = 120;
const MAX_PAGES = 80;
const absolute = (store, url) => url.startsWith("http") ? url : `${STORES[store].site}${url}`;
const tidyInstallments = (value) => value ? text(value).replace(/\$\s+/g, "$").replace(/,00\b/g, "") || null : null;
const uniq = (list) => [...new Set(list)];
const magentoOriginal = (url) => url.replace(/\/cache\/[0-9a-f]{32}\//, "/");
function parseMagentoPage(html, store, genders) {
  const numbers = [...html.matchAll(/toolbar-number">(\d+)/g)].map((match) => Number(match[1]));
  const total = numbers.length ? Math.max(...numbers) : null;
  const items = [];
  for (const chunk of chunks(html, '<li class="item product product-item">').map((part) => part.split("</ol>")[0])) {
    const id = pick(chunk, /product-item-info_(\d+)/);
    const url = pick(chunk, /class="product-item-link"\s+href="([^"]+)"/);
    const title = text(pick(chunk, /class="product-item-link"\s+href="[^"]+">([\s\S]*?)<\/a>/) ?? "");
    const price = money(pick(chunk, /data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"/));
    if (!id || !url || !title || !price || /stock unavailable|out-of-stock/.test(chunk)) continue;
    const listPrice = money(pick(chunk, /data-price-amount="([\d.]+)"\s+data-price-type="oldPrice"/));
    const mainTag = pick(chunk, /(<img class="product-image-photo"[^>]*>)/) ?? "";
    const main = pick(mainTag, /\ssrc="([^"]+)"/);
    const thumb = pick(mainTag, /(https?:\/\/\S+)\s+480w/) ?? main;
    const hover = pick(chunk, /<img class="hover-image product-image-photo"[^>]*?\ssrc="([^"]+)"/);
    const clean = cleanName(title);
    items.push({
      code: (main && codeFromMagentoImage(main)) ?? codeFromMagentoUrl(url),
      clean,
      offer: {
        store,
        storeProductId: id,
        url: decode(url),
        title,
        price,
        listPrice: listPrice && listPrice > price ? listPrice : null,
        installments: tidyInstallments(pick(chunk, /<div class="installments-price">([\s\S]*?)<\/div>/)),
        thumb: decode(thumb ?? ""),
        images: uniq([main, hover].filter((image) => !!image).map((image) => magentoOriginal(decode(image)))),
        genders: uniq([...genders, ...clean.genders])
      }
    });
  }
  return { items, total };
}
async function crawlMagento(store, fetchPage) {
  const found = [];
  for (const section of SECTIONS[store]) {
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
      const html = await fetchPage(`${STORES[store].site}${section.path}?product_list_limit=${MAGENTO_PAGE_SIZE}&p=${page}`);
      const { items, total } = parseMagentoPage(html, store, section.genders);
      if (page === 1 && total) pages = Math.ceil(total / MAGENTO_PAGE_SIZE);
      if (!items.length) break;
      found.push(...items);
    }
  }
  return found;
}
const dexterImage = (url, size) => decode(url).replace(/\?.*$/, `?sw=${size}&sh=${size}`);
function parseDexterPage(html, genders) {
  const items = [];
  for (const chunk of chunks(html, '<div class="product" data-pid="')) {
    const pid = pick(chunk, /data-pid="([^"]+)"/);
    const url = pick(chunk, /<div class="pdp-link">\s*<a class="link" href="([^"]+)"/);
    const title = text(pick(chunk, /<div class="pdp-link">\s*<a class="link"[^>]*>([\s\S]*?)<\/a>/) ?? "");
    const price = money(pick(chunk, /class="sales">\s*<span class="value" content="([\d.]+)"/));
    if (!pid || !url || !title || !price) continue;
    const listPrice = money(pick(chunk, /strike-through list">\s*<span class="value" content="([\d.]+)"/));
    const main = pick(chunk, /tile-image primary-image"\s+src="([^"]+)"/);
    const second = pick(chunk, /tile-image second-image"\s+src="([^"]+)"/);
    const clean = cleanName(title);
    items.push({
      code: codeFromDexterPid(pid),
      clean,
      offer: {
        store: "dexter",
        storeProductId: pid,
        url: absolute("dexter", decode(url)),
        title,
        price,
        listPrice: listPrice && listPrice > price ? listPrice : null,
        installments: tidyInstallments(pick(chunk, /<div class="installments-container[^"]*">([\s\S]*?)<\/div>\s*<\/a>/)),
        thumb: main ? dexterImage(main, 480) : "",
        images: [main, second].filter((image) => !!image).map((image) => dexterImage(image, 1e3)),
        genders: uniq([...genders, ...clean.genders])
      }
    });
  }
  return items;
}
async function crawlDexter(fetchPage) {
  const found = [];
  for (const section of SECTIONS.dexter) {
    const seen = /* @__PURE__ */ new Set();
    for (let page = 0; page < MAX_PAGES; page++) {
      const html = await fetchPage(`${STORES.dexter.site}${section.path}?start=${page * DEXTER_PAGE_SIZE}&sz=${DEXTER_PAGE_SIZE}`);
      const items = parseDexterPage(html, section.genders).filter((item) => !seen.has(item.offer.storeProductId));
      items.forEach((item) => seen.add(item.offer.storeProductId));
      found.push(...items);
      if (items.length < DEXTER_PAGE_SIZE) break;
    }
  }
  return found;
}
function crawlStore(store, fetchPage) {
  return store === "dexter" ? crawlDexter(fetchPage) : crawlMagento(store, fetchPage);
}
const STORE_IDS = Object.keys(STORES);
const HISTORY_POINTS = 120;
const HISTORY_FORGET_DAYS = 90;
const REVIEWS_TTL_MS = 12 * 60 * 60 * 1e3;
const MIN_LISTINGS = 20;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(/* @__PURE__ */ new Date());
const message = (error) => error instanceof Error ? error.message : String(error);
function politeFetcher({ delayMs, userAgent, fetchImpl = fetch }) {
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
              headers: { "User-Agent": userAgent, Accept: "text/html,application/xhtml+xml", "Accept-Language": "es-AR,es;q=0.9" },
              signal: AbortSignal.timeout(45e3)
            });
            if (response.ok) return await response.text();
            if (response.status === 404 || attempt >= 2) throw new Error(`${new URL(url).hostname} respondió ${response.status}`);
          } catch (error) {
            if (attempt >= 2 || message(error).includes("respondió 404")) throw error;
          }
          await sleep(5e3 * (attempt + 1));
        }
      } finally {
        last = Date.now();
      }
    });
    queue = run.then(() => void 0, () => void 0);
    return run;
  };
}
function summarize({ images: _images, offers, ...product }) {
  return { ...product, offers: offers.map(({ store, url, price, listPrice, installments }) => ({ store, url, price, listPrice, installments })) };
}
async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}
class PriceService {
  constructor(options) {
    this.options = options;
    this.rebuild();
  }
  options;
  stores = Object.fromEntries(STORE_IDS.map((id) => [id, { listings: [], updatedAt: null, error: null }]));
  products = /* @__PURE__ */ new Map();
  history = {};
  community = {};
  reviewCache = /* @__PURE__ */ new Map();
  refreshing = false;
  lastRefresh = 0;
  updatedAt = null;
  /** El catálogo ya serializado: se arma una vez por actualización y se sirve tal cual. */
  catalogJson = "";
  file = (name) => path.join(this.options.dataDir, name);
  log = (text2) => (this.options.log ?? console.log)(`[precios] ${text2}`);
  async start() {
    await mkdir(this.options.dataDir, { recursive: true });
    this.stores = { ...this.stores, ...await readJson(this.file("tiendas.json"), {}) };
    this.history = await readJson(this.file("historial.json"), {});
    this.community = await readJson(this.file("resenas.json"), {});
    this.updatedAt = STORE_IDS.map((id) => this.stores[id].updatedAt).filter(Boolean).sort()[0] ?? null;
    this.rebuild();
    const everyMs = this.options.refreshHours * 60 * 60 * 1e3;
    const oldest = Math.min(...STORE_IDS.map((id) => Date.parse(this.stores[id].updatedAt ?? "") || 0));
    this.lastRefresh = oldest;
    const tick = () => {
      if (Date.now() - this.lastRefresh >= everyMs) void this.refresh();
    };
    tick();
    setInterval(tick, Math.min(everyMs, 10 * 60 * 1e3)).unref();
  }
  /** Vuelve a leer las tres tiendas en paralelo (cada una despacio). Mientras tanto se sigue sirviendo lo anterior. */
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.lastRefresh = Date.now();
    this.rebuild();
    this.log("actualizando precios…");
    await Promise.all(
      STORE_IDS.map(async (id) => {
        const started = Date.now();
        try {
          const listings = await crawlStore(id, politeFetcher(this.options));
          if (listings.length < MIN_LISTINGS) throw new Error(`sólo ${listings.length} productos`);
          this.stores[id] = { listings, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), error: null };
          this.log(`${STORES[id].name}: ${listings.length} zapatillas en ${Math.round((Date.now() - started) / 1e3)} s`);
        } catch (error) {
          this.stores[id] = { ...this.stores[id], error: message(error) };
          this.log(`${STORES[id].name}: falló (${message(error)}), quedan los precios anteriores`);
        }
        this.rebuild();
      })
    );
    this.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.refreshing = false;
    this.recordHistory();
    this.rebuild();
    this.reviewCache.clear();
    await writeJson(this.file("tiendas.json"), this.stores);
    await writeJson(this.file("historial.json"), this.history);
    this.log(`listo: ${this.products.size} modelos`);
  }
  rebuild() {
    const products = buildProducts(STORE_IDS.flatMap((id) => this.stores[id].listings));
    this.products = new Map(products.map((product) => [product.id, product]));
    const catalog = {
      updatedAt: this.updatedAt,
      refreshing: this.refreshing,
      stores: Object.fromEntries(
        STORE_IDS.map((id) => [id, { name: STORES[id].name, count: this.stores[id].listings.length, updatedAt: this.stores[id].updatedAt, error: this.stores[id].error }])
      ),
      products: products.map(summarize)
    };
    this.catalogJson = JSON.stringify(catalog);
  }
  recordHistory() {
    const day = today();
    for (const product of this.products.values()) {
      const points = this.history[product.id] ??= [];
      const last = points[points.length - 1];
      if (last?.[0] === day) last[1] = product.best;
      else points.push([day, product.best]);
      if (points.length > HISTORY_POINTS) points.splice(0, points.length - HISTORY_POINTS);
    }
    const forget = new Date(Date.now() - HISTORY_FORGET_DAYS * 864e5).toISOString().slice(0, 10);
    for (const [id, points] of Object.entries(this.history)) {
      if (!this.products.has(id) && (points[points.length - 1]?.[0] ?? "") < forget) delete this.history[id];
    }
  }
  has(id) {
    return this.products.has(id);
  }
  async detail(id) {
    const product = this.products.get(id);
    if (!product) return null;
    let cached = this.reviewCache.get(id);
    if (!cached || Date.now() - cached.at > REVIEWS_TTL_MS) {
      const fetchPage = politeFetcher({ ...this.options, delayMs: 0 });
      const results = await Promise.allSettled(product.offers.map((offer) => fetchStoreReviews(offer.store, offer.storeProductId, fetchPage)));
      cached = {
        at: Date.now(),
        reviews: results.flatMap((result) => result.status === "fulfilled" ? result.value : []),
        errors: product.offers.filter((_, index) => results[index].status === "rejected").map((offer) => offer.store)
      };
      this.reviewCache.set(id, cached);
    }
    const community = [...this.community[id] ?? []].reverse();
    return { images: product.images, history: this.history[id] ?? [], reviews: [...community, ...cached.reviews], reviewErrors: cached.errors };
  }
  async addReview(id, input) {
    if (!this.products.has(id)) return "No encontramos ese producto.";
    const valid = validateReview(input);
    if (typeof valid === "string") return valid;
    const review = { source: "spot", author: valid.author, title: null, text: valid.text, rating: valid.rating, date: (/* @__PURE__ */ new Date()).toISOString() };
    (this.community[id] ??= []).push(review);
    await writeJson(this.file("resenas.json"), this.community);
    return review;
  }
}
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const service = new PriceService({
  dataDir: path.resolve(process.env.DATA_DIR ?? "data"),
  refreshHours: Number(process.env.PRICE_REFRESH_HOURS ?? 6),
  delayMs: Number(process.env.PRICE_DELAY_MS ?? 1500),
  userAgent: process.env.PRICE_USER_AGENT ?? "Mozilla/5.0 (compatible; SPOTPrecios/1.0; comparador de precios de zapatillas)"
});
const PRODUCT = /^\/api\/precios\/([a-z0-9-]{3,80})$/;
const REVIEWS = /^\/api\/precios\/([a-z0-9-]{3,80})\/resenas$/;
const REVIEWS_PER_HOUR = 5;
const posted = /* @__PURE__ */ new Map();
function send(response, status, body, cache = "no-cache") {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache });
  response.end(json);
}
function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() || request.socket.remoteAddress || "desconocido";
}
function allowReview(ip) {
  const hourAgo = Date.now() - 60 * 60 * 1e3;
  const recent = (posted.get(ip) ?? []).filter((time) => time > hourAgo);
  if (recent.length >= REVIEWS_PER_HOUR) return false;
  posted.set(ip, [...recent, Date.now()]);
  return true;
}
async function readBody(request, limit = 4096) {
  let size = 0;
  const parts = [];
  for await (const part of request) {
    size += part.length;
    if (size > limit) throw new Error("demasiado grande");
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  try {
    if (request.method === "GET" && pathname === "/api/precios") return send(response, 200, service.catalogJson, "public, max-age=60");
    const product = PRODUCT.exec(pathname);
    if (request.method === "GET" && product) {
      const detail = await service.detail(product[1]);
      return detail ? send(response, 200, detail) : send(response, 404, { error: "No encontramos ese producto." });
    }
    const reviews = REVIEWS.exec(pathname);
    if (request.method === "POST" && reviews) {
      if (!service.has(reviews[1])) return send(response, 404, { error: "No encontramos ese producto." });
      if (!allowReview(clientIp(request))) return send(response, 429, { error: "Ya dejaste varias reseñas. Probá de nuevo en un rato." });
      const result = await service.addReview(reviews[1], await readBody(request).catch(() => null));
      return typeof result === "string" ? send(response, 400, { error: result }) : send(response, 201, result);
    }
    if (pathname === "/api/salud") return send(response, 200, { ok: true });
    send(response, 404, { error: "No existe." });
  } catch (error) {
    console.error("[api]", error);
    send(response, 500, { error: "Algo falló de nuestro lado." });
  }
});
server.listen(PORT, HOST, () => console.log(`[api] escuchando en http://${HOST}:${PORT}`));
void service.start();
