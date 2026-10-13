import { describe, expect, it } from 'vitest';
import { addLine, CartLine, groupByMerchant, parseCart, removeLine, setQuantity, toOrderItems, totals } from './cart';
import { formatPrice, parsePrice } from './money';

const line = (patch: Partial<CartLine> = {}): CartLine => ({
  variantId: 'v1',
  productId: 'p1',
  merchantId: 'm1',
  merchantName: 'Running Shop',
  name: 'Zapatilla',
  variantLabel: '42 · Negro',
  image: null,
  priceCents: 10000,
  quantity: 1,
  maxStock: 5,
  ...patch,
});

describe('carrito', () => {
  it('suma la misma variante en una sola línea sin pasarse del stock', () => {
    let lines = addLine([], line({ quantity: 2 }));
    lines = addLine(lines, line({ quantity: 2 }));
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(4);
    lines = addLine(lines, line({ quantity: 10 }));
    expect(lines[0].quantity).toBe(5);
  });

  it('actualiza el precio y el stock con lo último que vio la tienda', () => {
    const lines = addLine(addLine([], line()), line({ priceCents: 12000, maxStock: 3 }));
    expect(lines[0]).toMatchObject({ priceCents: 12000, maxStock: 3, quantity: 2 });
  });

  it('no agrega nada sin stock', () => {
    expect(addLine([], line({ maxStock: 0 }))).toEqual([]);
  });

  it('cambia cantidades, las limita al stock y quita con 0', () => {
    const lines = [line(), line({ variantId: 'v2', maxStock: 3 })];
    expect(setQuantity(lines, 'v1', 4)[0].quantity).toBe(4);
    expect(setQuantity(lines, 'v2', 50)[1].quantity).toBe(3);
    expect(setQuantity(lines, 'v1', 0)).toHaveLength(1);
    expect(setQuantity(lines, 'v1', -2)).toHaveLength(1);
    expect(removeLine(lines, 'v2')).toHaveLength(1);
  });

  it('calcula unidades y subtotal', () => {
    const lines = [line({ quantity: 2 }), line({ variantId: 'v2', priceCents: 2550, quantity: 3 })];
    expect(totals(lines)).toEqual({ itemCount: 5, subtotalCents: 27650 });
    expect(totals([])).toEqual({ itemCount: 0, subtotalCents: 0 });
  });

  it('agrupa por comercio como se van a dividir los pedidos', () => {
    const groups = groupByMerchant([
      line(),
      line({ variantId: 'v2', merchantId: 'm2', merchantName: 'Fútbol Total', priceCents: 5000, quantity: 2 }),
      line({ variantId: 'v3', priceCents: 1000, quantity: 3 }),
    ]);
    expect(groups.map((group) => [group.merchantName, group.lines.length, group.subtotalCents])).toEqual([
      ['Running Shop', 2, 13000],
      ['Fútbol Total', 1, 10000],
    ]);
  });

  it('manda al servidor solo variante y cantidad', () => {
    expect(toOrderItems([line({ quantity: 2 })])).toEqual([{ variant_id: 'v1', quantity: 2 }]);
  });

  it('lee el carrito guardado y descarta lo roto', () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart('no es json')).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
    const saved = JSON.stringify([line(), { variantId: 'x' }, line({ variantId: 'v9', quantity: 0 }), line({ variantId: 'v8', quantity: 50, maxStock: 4 })]);
    const lines = parseCart(saved);
    expect(lines.map((l) => [l.variantId, l.quantity])).toEqual([['v1', 1], ['v8', 4]]);
  });
});

describe('dinero', () => {
  it('formatea centavos como pesos', () => {
    expect(formatPrice(1250000)).toBe('$ 12.500');
    expect(formatPrice(1250050)).toBe('$ 12.500,50');
    expect(formatPrice(0)).toBe('$ 0');
  });

  it('entiende cómo escribe la gente un precio', () => {
    expect(parsePrice('12500')).toBe(1250000);
    expect(parsePrice('12.500')).toBe(1250000);
    expect(parsePrice('12.500,50')).toBe(1250050);
    expect(parsePrice('$ 99,9')).toBe(9990);
    expect(parsePrice('12500.5')).toBe(1250050);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('-5')).toBeNull();
    expect(parsePrice('1,2,3')).toBeNull();
  });
});
