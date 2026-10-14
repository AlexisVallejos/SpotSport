import type { Category, Gender, Sport } from '../../shared/precios';

// Marcas como se escriben de verdad. Las de varias palabras van primero para que ganen.
const BRANDS = [
  'adidas Originals', 'adidas Sportswear', 'adidas', 'New Balance', 'Under Armour', 'Le Coq Sportif', 'Hi-Tec', 'John Foos', 'Hush Puppies',
  'On Running', 'On', 'DC Shoes', 'DC', 'Nike', 'Jordan', 'Puma', 'Reebok', 'Fila', 'Topper', 'ASICS', 'Mizuno', 'Saucony', 'HOKA', 'Vans', 'Converse',
  'Skechers', 'Merrell', 'Salomon', 'Columbia', 'Kappa', 'Umbro', 'Joma', 'Penalty', 'Athix', 'Head', 'Wilson', 'Babolat', 'Lotto', 'Crocs',
  'Timberland', 'Lacoste', 'Champion', 'Montagne', 'Olympikus', 'Diadora', 'Awca', 'Element', 'Etnies', 'Quiksilver', 'Kioshi', 'Gaelle',
  'Footy', 'Atomik', 'Caterpillar', 'Rusty', 'Mormaii', 'Brooks', 'Altra', 'Karhu', 'Veja', 'Ellesse', 'Prince', 'Yonex', 'Kelme', 'Mitre',
  'Fanatics', 'Roxy', 'Billabong', 'Shimano', 'Garmin', 'Bullpadel', 'Gilbert', 'Nassau', 'Vairo', 'X-TRUST', 'Speedo', 'Arena', 'Hydro Flask',
  'Stanley', 'Herschel', 'Jansport', 'Oakley', 'Dunlop', 'Siux', 'Adidas Padel', 'Everlast', 'Proyec', 'Sorel', 'The North Face', 'Kosiuko',
  'Tommy Hilfiger', 'Calvin Klein', 'Levi\'s', 'Wrangler', 'Hurley', 'Volcom', 'Santa Cruz', 'Thrasher', 'Dickies', 'Carhartt',
];

// "adidas Originals Samba" se filtra como adidas: la línea queda en el nombre.
const BRAND_FAMILY: Record<string, string> = { 'adidas Originals': 'adidas', 'adidas Sportswear': 'adidas', 'Adidas Padel': 'adidas', 'DC Shoes': 'DC', 'On Running': 'On' };

// Tipo de producto al principio del nombre → [tipo, categoría]. El orden importa: lo más específico primero.
const TYPES: [RegExp, string, Category][] = [
  [/^zapatillas?\b/i, 'Zapatillas', 'calzado'],
  [/^(botines|bot[ií]n)\b/i, 'Botines', 'calzado'],
  [/^(pack\s+(de\s+|x\s*\d+\s+)?)?(medias?|soquetes?)\b/i, 'Medias', 'accesorios'],
  [/^(remeras?|chombas?|polos?)\b/i, 'Remera', 'indumentaria'],
  [/^musculosas?\b/i, 'Musculosa', 'indumentaria'],
  [/^(tops?|corpiños?|bras?)\b/i, 'Top', 'indumentaria'],
  [/^(camisetas?|jerseys?|maillots?)\b/i, 'Camiseta', 'indumentaria'],
  [/^(buzos?|hoodies?|sweaters?|poleras?|canguros?)\b/i, 'Buzo', 'indumentaria'],
  [/^(camperas?|rompevientos?|parkas?|chalecos?|chaquetas?)\b/i, 'Campera', 'indumentaria'],
  [/^(pantal[oó]n(es)?|joggers?|jeans?|babuchas?)\b/i, 'Pantalón', 'indumentaria'],
  [/^(calzas?|leggings?|leggins?|bikers?|pescadores?)\b/i, 'Calza', 'indumentaria'],
  [/^(shorts?|bermudas?)\b/i, 'Short', 'indumentaria'],
  [/^(polleras?|faldas?)\b/i, 'Pollera', 'indumentaria'],
  [/^conjuntos?\b/i, 'Conjunto', 'indumentaria'],
  [/^(mallas?|trajes?\s+de\s+ba[ñn]o|bikinis?)\b/i, 'Malla', 'indumentaria'],
  [/^camisas?\b/i, 'Camisa', 'indumentaria'],
  [/^(vestidos?|enteritos?)\b/i, 'Vestido', 'indumentaria'],
  [/^(gorras?|gorros?|pilusos?|caps?|beanies?|viseras?)\b/i, 'Gorra', 'accesorios'],
  [/^mochilas?\b/i, 'Mochila', 'accesorios'],
  [/^(bolsos?|morral(es)?|ri[ñn]oneras?|carteras?|botineros?|valijas?|neceser(es)?|totes?)\b/i, 'Bolso', 'accesorios'],
  [/^pelotas?\b/i, 'Pelota', 'accesorios'],
  [/^guantes?\b/i, 'Guantes', 'accesorios'],
  [/^(antiparras?|gafas?|anteojos?)\b/i, 'Anteojos', 'accesorios'],
  [/^(botellas?|caramañolas?|termos?|vasos?)\b/i, 'Botella', 'accesorios'],
  [/^canilleras?\b/i, 'Canilleras', 'accesorios'],
  [/^(paletas?|raquetas?)\b/i, 'Paleta', 'accesorios'],
  [/^(relojes?)\b/i, 'Reloj', 'accesorios'],
  [/^(rodilleras?|mu[ñn]equeras?|tobilleras?|coderas?|pantorrilleras?|gemeleras?|vendas?)\b/i, 'Protección', 'accesorios'],
  [/^cascos?\b/i, 'Casco', 'accesorios'],
  [/^billeteras?\b/i, 'Billetera', 'accesorios'],
];

// Palabras de deporte que las tiendas ponen como etiqueta antes de la marca ("Remera Running Fila…").
const SPORT_WORDS: [RegExp, Sport | null][] = [
  [/^(de\s+)?(running|trail(\s+running)?)\b/i, 'Running'],
  [/^(de\s+)?(training|entrenamiento)\b/i, 'Training'],
  [/^(de\s+)?f[uú]tbol\b/i, 'Fútbol'],
  [/^(urbanas?|moda|lifestyle|sportstyle)\b/i, 'Urbana'],
  [/^(de\s+)?outdoor\b/i, 'Outdoor'],
  [/^(de\s+)?(t[eé]nis|p[aá]del)\b/i, 'Tenis y pádel'],
  [/^(de\s+)?(b[aá]squet|basket)\b/i, 'Básquet'],
  [/^(de\s+)?(v[oó]ley|handball|rugby|hockey|nataci[oó]n|skate|walking|caminata)\b/i, null],
  [/^deportivas?\b/i, null],
];

// Pistas de deporte en cualquier parte del nombre.
const SPORT_HINTS: [RegExp, Sport][] = [
  [/\b(running|run|runner|marat[oó]n|trail)\b/i, 'Running'],
  [/\b(training|train|entrenamiento|gym|hyrox|crossfit|yoga|fitness)\b/i, 'Training'],
  [/\b(f[uú]tbol|football|soccer|boca juniors|river plate|san lorenzo|racing club|independiente|selecci[oó]n|afa|fg|tf|turf)\b/i, 'Fútbol'],
  [/\b(originals|sportswear|lifestyle|urbana|sportstyle|jordan)\b/i, 'Urbana'],
  [/\b(nba|b[aá]squet|basketball)\b/i, 'Básquet'],
  [/\b(t[eé]nis|p[aá]del)\b/i, 'Tenis y pádel'],
  [/\b(outdoor|trekking|hiking|gore-?tex)\b/i, 'Outdoor'],
];

const GENDER_WORDS: [RegExp, Gender[]][] = [
  [/\b(hombre\s+y\s+mujer|mujer\s+y\s+hombre|unisex)$/i, ['Hombre', 'Mujer']],
  [/\bhombres?$/i, ['Hombre']],
  [/\bmujer(es)?$/i, ['Mujer']],
  [/\b(niñ[oa]s?|nin[oa]s?|kids|junior|infantil(es)?|beb[eé]s?|young|juvenil)$/i, ['Niños']],
];

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND_PATTERNS = BRANDS.map((brand) => [brand, new RegExp(`(^|\\s)${escape(fold(brand))}(?=\\s|$)`)] as const);

/** "samba" → "Samba", "DOWNSHIFTER" → "Downshifter"; siglas cortas y números ("OG", "2.0", "'07") quedan igual. */
function tidyWord(word: string): string {
  if (/^(i{2,3}|iv|vi{1,3}|ix)$/i.test(word)) return word.toUpperCase(); // "Ii" → "II"
  if (/^[a-z]{1,3}\d+$/i.test(word)) return word.toUpperCase(); // "Sl2" → "SL2"
  if (/\d/.test(word)) return word;
  if (word.length > 3 && word === word.toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  if (word.length > 4 && word === word.toUpperCase()) return word[0] + word.slice(1).toLowerCase();
  return word;
}

const tidy = (words: string) => words.split(' ').filter(Boolean).map(tidyWord).join(' ');

export type CleanName = {
  /** Nombre completo: "adidas Samba OG", "Remera Fila Bio III Flow". */
  name: string;
  /** Lo mismo sin la marca, para el título de la carta: "Samba OG", "Remera Bio III Flow". */
  title: string;
  /** Marca para filtrar ("adidas" incluye adidas Originals). */
  brand: string;
  type: string | null;
  category: Category | null;
  sports: Sport[];
  genders: Gender[];
};

/**
 * "Zapatillas Running Nike Downshifter 14 Mujer" → Nike Downshifter 14 · Zapatillas · Running · Mujer.
 * "Camiseta Boca Juniors adidas Suplente 26 27 Mujer" → Camiseta adidas Boca Juniors Suplente 26 27 · Fútbol.
 */
export function cleanName(raw: string): CleanName {
  let rest = raw.replace(/\s+/g, ' ').trim();
  // Dexter corta los nombres largos: "… Mujer poliést...". La palabra cortada no aporta.
  rest = rest.replace(/\s+\S*(\.\.\.|…)$/, '').trim();

  let genders: Gender[] = [];
  for (const [pattern, value] of GENDER_WORDS) {
    if (pattern.test(rest)) {
      genders = value;
      rest = rest.replace(pattern, '').trim();
      break;
    }
  }

  let type: string | null = null;
  let category: Category | null = null;
  let typeLabel = '';
  for (const [pattern, label, group] of TYPES) {
    const match = pattern.exec(rest);
    if (match) {
      type = label;
      category = group;
      typeLabel = label === 'Zapatillas' || label === 'Botines' ? label : tidy(match[0].replace(/^pack\s+(de\s+|x\s*\d+\s+)?/i, (pack) => `${pack[0].toUpperCase()}${pack.slice(1).toLowerCase()}`));
      rest = rest.slice(match[0].length).trim();
      // "Buzo con Cierre…": el agregado es parte del tipo.
      const extra = /^((con|sin)\s+\S+)\s*/i.exec(rest);
      if (extra) {
        typeLabel += ` ${extra[1].toLowerCase()}`;
        rest = rest.slice(extra[0].length);
      }
      break;
    }
  }

  const sports = new Set<Sport>();
  const takeSportWords = (text: string) => {
    let remaining = text;
    for (let found = true; found; ) {
      found = false;
      for (const [pattern, sport] of SPORT_WORDS) {
        if (pattern.test(remaining)) {
          if (sport) sports.add(sport);
          remaining = remaining.replace(pattern, '').trim();
          found = true;
          break;
        }
      }
    }
    return remaining;
  };
  rest = takeSportWords(rest);

  // La marca puede no estar primera ("Camiseta Boca Juniors adidas…"): buscamos la primera que aparezca.
  const folded = fold(rest);
  let brandText: string | null = null;
  let before = '';
  let after = rest;
  let earliest = Infinity;
  for (const [brand, pattern] of BRAND_PATTERNS) {
    const match = pattern.exec(folded);
    if (match && match.index + match[1].length < earliest) {
      earliest = match.index + match[1].length;
      brandText = brand;
    }
  }
  if (brandText) {
    before = takeSportWords(rest.slice(0, earliest).trim());
    after = rest.slice(earliest + brandText.length).trim();
  } else {
    const [first, ...others] = rest.split(' ');
    brandText = tidyWord(first ?? '');
    after = others.join(' ');
  }

  // Dexter a veces pone el uso al final: "Revolution 8 Running".
  const trailing = /\s+(running|training)$/i.exec(` ${after}`);
  if (trailing) {
    sports.add(trailing[1].toLowerCase() === 'running' ? 'Running' : 'Training');
    after = after.slice(0, Math.max(0, trailing.index - 1)).trim();
  }

  for (const [pattern, sport] of SPORT_HINTS) if (pattern.test(raw)) sports.add(sport);

  const model = tidy([before, after].filter(Boolean).join(' '));
  const isShoe = !type || type === 'Zapatillas';
  const name = [isShoe ? '' : typeLabel, brandText, model].filter(Boolean).join(' ');
  const title = [isShoe ? '' : typeLabel, model].filter(Boolean).join(' ') || name;
  return { name, title, brand: BRAND_FAMILY[brandText] ?? brandText, type, category, sports: [...sports], genders };
}

const alnum = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Código de modelo normalizado desde el nombre de archivo de la foto de Magento
 * (".../j/r/jr1912_0.jpg" → "JR1912", ".../553558-045_0_8.jpg" → "553558045").
 */
export function codeFromMagentoImage(url: string): string | null {
  const file = url.split('?')[0].split('/').pop() ?? '';
  const stem = file.replace(/\.(jpe?g|png|webp|gif)$/i, '').split('_')[0];
  const code = alnum(stem);
  return code.length >= 5 && /\d/.test(code) ? code : null;
}

/**
 * Respaldo cuando la foto no sirve: el código va al final de la URL
 * ("zapatillas-nike-air-force-1-07-ih1698-001.html" → "IH1698001").
 */
export function codeFromMagentoUrl(url: string): string | null {
  const slug = (url.split('?')[0].split('/').pop() ?? '').replace(/\.html$/, '');
  const tokens = slug.split('-');
  let last = tokens.pop() ?? '';
  // Sufijo de color corto ("-001", "-7954"): pertenece al código anterior.
  if (/^\d{1,4}$/.test(last) && tokens.length) last = `${tokens.pop()}${last}`;
  const code = alnum(last);
  return code.length >= 5 && /\d/.test(code) ? code : null;
}

/** Dexter antepone dos letras de marca al código del fabricante: "NIFQ1831-001" → "FQ1831001". */
export function codeFromDexterPid(pid: string): string | null {
  const code = alnum(pid.slice(2));
  return code.length >= 4 ? code : null;
}
