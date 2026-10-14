// Ayudas mínimas para leer el HTML público de las tiendas sin depender de un parser.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿',
  ordm: 'º', ordf: 'ª', deg: '°', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—',
};

export function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return NAMED[code] ?? whole;
  });
}

/** Texto visible de un fragmento: sin etiquetas, entidades resueltas y espacios colapsados. */
export function text(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Primer grupo capturado, o null. */
export function pick(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1] ?? null;
}

/** Corta el HTML en un pedazo por producto, empezando en cada aparición de `marker`. */
export function chunks(html: string, marker: string): string[] {
  const parts = html.split(marker);
  return parts.slice(1).map((part) => marker + part);
}

export function money(value: string | null): number | null {
  if (value === null) return null;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}
