/** Lógica pura del carrito. Los precios son solo de referencia: al confirmar, el servidor usa los suyos. */
export type CartLine = {
  variantId: string;
  productId: string;
  merchantId: string;
  merchantName: string;
  name: string;
  variantLabel: string;
  image: string | null;
  priceCents: number;
  quantity: number;
  /** Stock conocido al agregarlo: evita pedir más de lo que hay. */
  maxStock: number;
};

export const MAX_PER_LINE = 99;

const cap = (quantity: number, line: Pick<CartLine, 'maxStock'>) => Math.max(0, Math.min(Math.floor(quantity), line.maxStock, MAX_PER_LINE));

/** Suma una variante; si ya estaba, suma cantidades sin pasarse del stock. */
export function addLine(lines: CartLine[], incoming: CartLine): CartLine[] {
  const found = lines.find((line) => line.variantId === incoming.variantId);
  if (!found) {
    const quantity = cap(incoming.quantity, incoming);
    return quantity > 0 ? [...lines, { ...incoming, quantity }] : lines;
  }
  return lines.map((line) =>
    line.variantId === incoming.variantId
      ? { ...line, priceCents: incoming.priceCents, maxStock: incoming.maxStock, quantity: cap(line.quantity + incoming.quantity, incoming) }
      : line,
  );
}

/** Cambia la cantidad; 0 o menos la quita. */
export function setQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  return lines
    .map((line) => (line.variantId === variantId ? { ...line, quantity: cap(quantity, line) } : line))
    .filter((line) => line.quantity > 0);
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((line) => line.variantId !== variantId);
}

export function totals(lines: CartLine[]) {
  return {
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0),
  };
}

export type MerchantGroup = { merchantId: string; merchantName: string; lines: CartLine[]; subtotalCents: number };

/** Un grupo por comercio, en el orden en que se agregaron: es como se van a dividir los pedidos. */
export function groupByMerchant(lines: CartLine[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const line of lines) {
    const group = groups.get(line.merchantId) ?? { merchantId: line.merchantId, merchantName: line.merchantName, lines: [], subtotalCents: 0 };
    group.lines.push(line);
    group.subtotalCents += line.priceCents * line.quantity;
    groups.set(line.merchantId, group);
  }
  return [...groups.values()];
}

/** Lo que espera `place_order`: solo variante y cantidad. */
export function toOrderItems(lines: CartLine[]) {
  return lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity }));
}

const isLine = (value: unknown): value is CartLine => {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.variantId === 'string' &&
    typeof line.productId === 'string' &&
    typeof line.merchantId === 'string' &&
    typeof line.merchantName === 'string' &&
    typeof line.name === 'string' &&
    typeof line.variantLabel === 'string' &&
    (line.image === null || typeof line.image === 'string') &&
    Number.isFinite(line.priceCents) &&
    Number.isInteger(line.quantity) &&
    (line.quantity as number) > 0 &&
    Number.isInteger(line.maxStock)
  );
};

/** Lee el carrito guardado en el navegador descartando lo que no sea válido. */
export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isLine).map((line) => ({ ...line, quantity: cap(line.quantity, line) })).filter((line) => line.quantity > 0);
  } catch {
    return [];
  }
}
