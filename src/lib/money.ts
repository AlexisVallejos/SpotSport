const whole = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1250000 → "$ 12.500"; 1250050 → "$ 12.500,50". Los precios se guardan en centavos para no tener errores de redondeo. */
export function formatPrice(cents: number): string {
  const formatter = cents % 100 === 0 ? whole : withCents;
  return formatter.format(cents / 100).replace(/ /g, ' ');
}

/**
 * Entiende cómo escribe un precio la gente en Argentina: "12500", "12.500", "12.500,50", "99,9".
 * Devuelve centavos, o null si no es un monto válido.
 */
export function parsePrice(input: string): number | null {
  const text = input.trim().replace(/\s|\$/g, '');
  if (!text) return null;
  let normalized: string;
  if (/,\d{1,2}$/.test(text)) normalized = text.replace(/\./g, '').replace(',', '.'); // 12.500,50
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, ''); // 12.500
  else normalized = text.replace(/,/g, ''); // 12500 · 12500.5
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** 1250000 → "12500" para mostrarlo en un campo de edición. */
export function toInputPrice(cents: number): string {
  return String(cents / 100);
}
