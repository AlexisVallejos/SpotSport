import type { Category, Gender, SearchQuery, SortKey, Sport, StoreId } from './precios';

// Entiende búsquedas escritas como las diría una persona ("botines nike baratos", "remera running mujer")
// y las convierte en filtros. Lo que no reconoce queda como texto libre.

export type TokenKind = 'category' | 'type' | 'sport' | 'gender' | 'brand' | 'store' | 'sort' | 'compared';

export type Token = { kind: TokenKind; label: string; words: string[]; patch: Partial<SearchQuery> };

export type ParsedSearch = { tokens: Token[]; text: string; query: SearchQuery };

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Rule = { phrases: string[]; kind: TokenKind; label: string; patch: Partial<SearchQuery> };

const shoes = (type: string): Partial<SearchQuery> => ({ category: 'calzado', type });
const apparel = (type: string): Partial<SearchQuery> => ({ category: 'indumentaria', type });
const accessory = (type: string): Partial<SearchQuery> => ({ category: 'accesorios', type });
const sport = (value: Sport): Partial<SearchQuery> => ({ sport: value });
const botines: Partial<SearchQuery> = { category: 'calzado', type: 'Botines', sport: 'Fútbol' };
const gender = (value: Gender): Partial<SearchQuery> => ({ gender: value });
const store = (value: StoreId): Partial<SearchQuery> => ({ store: value });
const sort = (value: SortKey): Partial<SearchQuery> => ({ sort: value });
const category = (value: Category): Partial<SearchQuery> => ({ category: value });

const BRANDS = ['adidas', 'Nike', 'Puma', 'Topper', 'Fila', 'Under Armour', 'New Balance', 'Vans', 'Converse', 'ASICS', 'Reebok', 'HOKA', 'Jordan', 'Skechers', 'Lacoste', 'Le Coq Sportif', 'Diadora', 'Kappa', 'Umbro', 'Mizuno', 'Saucony', 'Salomon', 'Merrell', 'Columbia', 'Montagne', 'Atomik', 'DC', 'Lotto', 'Head', 'Wilson', 'Speedo', 'Penalty', 'Crocs'];

// Más largas primero: "más baratas" gana sobre "baratas", "under armour" sobre "under".
const RAW_RULES: Rule[] = [
  { phrases: ['zapatillas', 'zapatilla', 'zapas', 'zapa'], kind: 'type', label: 'Zapatillas', patch: shoes('Zapatillas') },
  { phrases: ['botines', 'botin', 'chimpunes'], kind: 'type', label: 'Botines', patch: botines },
  { phrases: ['calzado'], kind: 'category', label: 'Calzado', patch: category('calzado') },
  { phrases: ['ropa', 'indumentaria', 'prendas'], kind: 'category', label: 'Indumentaria', patch: category('indumentaria') },
  { phrases: ['accesorios', 'accesorio'], kind: 'category', label: 'Accesorios', patch: category('accesorios') },
  { phrases: ['remeras', 'remera', 'chombas', 'chomba'], kind: 'type', label: 'Remeras', patch: apparel('Remera') },
  { phrases: ['musculosas', 'musculosa'], kind: 'type', label: 'Musculosas', patch: apparel('Musculosa') },
  { phrases: ['camisetas', 'camiseta', 'jerseys', 'jersey'], kind: 'type', label: 'Camisetas', patch: apparel('Camiseta') },
  { phrases: ['buzos', 'buzo', 'hoodies', 'hoodie', 'canguros', 'canguro'], kind: 'type', label: 'Buzos', patch: apparel('Buzo') },
  { phrases: ['camperas', 'campera', 'rompevientos', 'parkas', 'chalecos'], kind: 'type', label: 'Camperas', patch: apparel('Campera') },
  { phrases: ['pantalones', 'pantalon', 'joggers', 'jogger'], kind: 'type', label: 'Pantalones', patch: apparel('Pantalón') },
  { phrases: ['calzas', 'calza', 'leggings', 'leggins'], kind: 'type', label: 'Calzas', patch: apparel('Calza') },
  { phrases: ['shorts', 'short', 'bermudas', 'bermuda'], kind: 'type', label: 'Shorts', patch: apparel('Short') },
  { phrases: ['tops', 'top', 'corpiños', 'corpino', 'bras'], kind: 'type', label: 'Tops', patch: apparel('Top') },
  { phrases: ['conjuntos', 'conjunto'], kind: 'type', label: 'Conjuntos', patch: apparel('Conjunto') },
  { phrases: ['medias', 'soquetes'], kind: 'type', label: 'Medias', patch: accessory('Medias') },
  { phrases: ['gorras', 'gorra', 'gorros', 'gorro', 'viseras'], kind: 'type', label: 'Gorras', patch: accessory('Gorra') },
  { phrases: ['mochilas', 'mochila'], kind: 'type', label: 'Mochilas', patch: accessory('Mochila') },
  { phrases: ['bolsos', 'bolso', 'riñoneras', 'rinonera', 'botineros'], kind: 'type', label: 'Bolsos', patch: accessory('Bolso') },
  { phrases: ['pelotas', 'pelota'], kind: 'type', label: 'Pelotas', patch: accessory('Pelota') },
  { phrases: ['para correr', 'running', 'correr', 'runner'], kind: 'sport', label: 'Running', patch: sport('Running') },
  { phrases: ['entrenamiento', 'training', 'gimnasio', 'gym'], kind: 'sport', label: 'Training', patch: sport('Training') },
  { phrases: ['futbol', 'football'], kind: 'sport', label: 'Fútbol', patch: sport('Fútbol') },
  { phrases: ['urbanas', 'urbana', 'urbanos', 'urbano', 'lifestyle', 'sportstyle', 'moda'], kind: 'sport', label: 'Urbana', patch: sport('Urbana') },
  { phrases: ['basquet', 'basket', 'basketball'], kind: 'sport', label: 'Básquet', patch: sport('Básquet') },
  { phrases: ['tenis', 'padel'], kind: 'sport', label: 'Tenis y pádel', patch: sport('Tenis y pádel') },
  { phrases: ['outdoor', 'trekking', 'montaña'], kind: 'sport', label: 'Outdoor', patch: sport('Outdoor') },
  { phrases: ['para hombre', 'hombres', 'hombre', 'masculino'], kind: 'gender', label: 'Hombre', patch: gender('Hombre') },
  { phrases: ['para mujer', 'mujeres', 'mujer', 'femenino', 'dama'], kind: 'gender', label: 'Mujer', patch: gender('Mujer') },
  { phrases: ['para chicos', 'niños', 'nino', 'nina', 'nenes', 'nenas', 'chicos', 'kids', 'infantil'], kind: 'gender', label: 'Niños', patch: gender('Niños') },
  { phrases: ['en open sports', 'open sports', 'opensports'], kind: 'store', label: 'Open Sports', patch: store('opensports') },
  { phrases: ['en dexter', 'dexter'], kind: 'store', label: 'Dexter', patch: store('dexter') },
  { phrases: ['en trip store', 'trip store', 'tripstore', 'en trip', 'trip'], kind: 'store', label: 'Trip Store', patch: store('trip') },
  { phrases: ['mas baratas', 'mas baratos', 'mas barata', 'mas barato', 'baratas', 'baratos', 'barata', 'barato', 'economicas', 'economicos'], kind: 'sort', label: 'Más baratos', patch: sort('menor') },
  { phrases: ['mas caras', 'mas caros', 'premium'], kind: 'sort', label: 'Más caros', patch: sort('mayor') },
  { phrases: ['en oferta', 'ofertas', 'oferta', 'descuentos', 'descuento', 'rebajas', 'liquidacion', 'sale'], kind: 'sort', label: 'Más rebajados', patch: sort('descuento') },
  { phrases: ['novedades', 'nuevas', 'nuevos', 'nuevo', 'nueva', 'lanzamientos'], kind: 'sort', label: 'Recién llegados', patch: sort('nuevos') },
  { phrases: ['comparar', 'comparables', 'en varias tiendas'], kind: 'compared', label: 'En varias tiendas', patch: { compared: true } },
  ...BRANDS.map((brand): Rule => ({ phrases: [fold(brand)], kind: 'brand', label: brand, patch: { brand } })),
];
const RULES = RAW_RULES.map((rule) => ({ ...rule, phrases: rule.phrases.map(fold) }));

const PHRASES = RULES.flatMap((rule) => rule.phrases.map((phrase) => ({ phrase, words: phrase.split(' '), rule }))).sort((a, b) => b.words.length - a.words.length || b.phrase.length - a.phrase.length);

// Palabras que sólo unen ("botines de fútbol para hombre"): se descartan si quedan sueltas.
const FILLER = new Set(['de', 'para', 'en', 'la', 'las', 'los', 'el', 'y', 'con', 'que', 'mas', 'muy', 'unas', 'unos']);

/** "botines nike baratos" → tokens [Botines, Nike, Más baratos], texto "" y la búsqueda lista para la API. */
export function parseSearch(input: string, base: SearchQuery = {}): ParsedSearch {
  const original = input.trim().split(/\s+/).filter(Boolean);
  const words = original.map(fold);
  const used = new Array(words.length).fill(false);
  const tokens: Token[] = [];
  const seen = new Set<TokenKind>();

  for (let index = 0; index < words.length; index++) {
    if (used[index]) continue;
    const match = PHRASES.find(({ words: phrase }) => phrase.every((word, offset) => words[index + offset] === word));
    if (!match) continue;
    const span = match.words.length;
    for (let offset = 0; offset < span; offset++) used[index + offset] = true;
    // Una sola cosa de cada clase: "nike adidas" deja Nike como filtro y adidas como texto.
    if (seen.has(match.rule.kind)) {
      for (let offset = 0; offset < span; offset++) used[index + offset] = false;
      continue;
    }
    seen.add(match.rule.kind);
    tokens.push({ kind: match.rule.kind, label: match.rule.label, words: original.slice(index, index + span), patch: match.rule.patch });
    index += span - 1;
  }

  const leftovers = original.filter((_, index) => !used[index]);
  const text = leftovers.every((word) => FILLER.has(fold(word))) ? '' : leftovers.join(' ');
  const query: SearchQuery = { ...base, q: text };
  for (const token of tokens) Object.assign(query, token.patch);
  return { tokens, text, query };
}

/** Saca del texto las palabras de un token (para la ✕ de cada filtro detectado). */
export function removeToken(input: string, token: Token): string {
  const target = token.words.map(fold);
  const words = input.trim().split(/\s+/).filter(Boolean);
  for (let index = 0; index <= words.length - target.length; index++) {
    if (target.every((word, offset) => fold(words[index + offset]) === word)) {
      words.splice(index, target.length);
      break;
    }
  }
  return words.join(' ');
}
